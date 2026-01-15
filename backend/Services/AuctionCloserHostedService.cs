using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.SignalR;
using AuctionApi.Data;    
using AuctionApi.Hubs;    

namespace AuctionApi.Services
{
    public class AuctionCloserHostedService : BackgroundService
    {
        private readonly IServiceProvider _services;
        private readonly ILogger<AuctionCloserHostedService> _logger;
        private readonly TimeSpan _pollInterval = TimeSpan.FromSeconds(30);

        public AuctionCloserHostedService(IServiceProvider services, ILogger<AuctionCloserHostedService> logger)
        {
            _services = services ?? throw new ArgumentNullException(nameof(services));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("AuctionCloserHostedService started. Poll interval: {Interval}s", _pollInterval.TotalSeconds);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _services.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                    var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();
                    var hub = scope.ServiceProvider.GetRequiredService<IHubContext<AuctionHub>>();

                    // Use IsClosed boolean instead of AuctionStatus enum
                    var dueAuctions = await db.Auctions
                        .Where(a => a.IsClosed == false && a.EndTime <= DateTime.UtcNow)
                        .ToListAsync(stoppingToken);

                    if (dueAuctions.Any())
                    {
                        _logger.LogInformation("Found {Count} auctions to close.", dueAuctions.Count);
                    }

                    foreach (var auction in dueAuctions)
                    {
                        try
                        {
                            await ResolveAuctionClosureAsync(db, notificationService, hub, auction.Id, stoppingToken);
                        }
                        catch (Exception exAuction)
                        {
                            _logger.LogError(exAuction, "Error while resolving auction id {AuctionId}", auction.Id);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in AuctionCloserHostedService main loop.");
                }

                try
                {
                    await Task.Delay(_pollInterval, stoppingToken);
                }
                catch (TaskCanceledException)
                {
                    // shutting down
                }
            }

            _logger.LogInformation("AuctionCloserHostedService is stopping.");
        }

        private async Task ResolveAuctionClosureAsync(
            ApplicationDbContext db,
            INotificationService notificationService,
            IHubContext<AuctionHub> hub,
            int auctionId,
            CancellationToken ct)
        {
            // Use a transaction to ensure consistency
            await using var tx = await db.Database.BeginTransactionAsync(ct);

            // Re-load auction in the scope of the transaction (fresh state)
            var auction = await db.Auctions
                .Include(a => a.Bids)
                .FirstOrDefaultAsync(a => a.Id == auctionId, ct);

            if (auction == null)
            {
                _logger.LogWarning("Auction id {AuctionId} not found during resolve.", auctionId);
                await tx.RollbackAsync(ct);
                return;
            }

            // Use IsClosed flag (instead of AuctionStatus enum)
            if (auction.IsClosed)
            {
                _logger.LogDebug("Auction id {AuctionId} already closed; skipping.", auctionId);
                await tx.RollbackAsync(ct);
                return;
            }

            // Determine top bid (by Amount desc, then earliest Time as tiebreaker)
            var topBid = await db.Bids
                .Where(b => b.AuctionId == auctionId)
                .OrderByDescending(b => b.Amount)
                .ThenBy(b => b.Time)
                .FirstOrDefaultAsync(ct);

            if (topBid != null)
            {
                auction.WinnerId = topBid.BidderId;
            }

            // Mark auction closed (don't touch AuctionStatus enum that may not exist)
            auction.IsClosed = true;
            // NOTE: removed any assignment to auction.ClosedAt or auction.Status to avoid type mismatches

            await db.SaveChangesAsync(ct);

            // Create notifications
            if (topBid != null && !string.IsNullOrEmpty(topBid.BidderId))
            {
                try
                {
                    var title = "You won an auction!";
                    var message = $"You won '{auction.Title}' with a bid of {topBid.Amount:C} (Auction #{auction.Id}).";
                    await notificationService.CreateAsync(topBid.BidderId, title, message, auctionId: auction.Id, bidId: topBid.Id);
                }
                catch (Exception exNotif)
                {
                    _logger.LogError(exNotif, "Failed to create/send winner notification for auction {AuctionId}", auction.Id);
                    // don't abort the transaction for notification failures (depending on your choice you might want to)
                }
            }

            if (!string.IsNullOrEmpty(auction.SellerId))
            {
                try
                {
                    var sTitle = "Your auction closed";
                    var sMessage = topBid != null
                        ? $"Your item '{auction.Title}' has been sold to user (id: {topBid.BidderId}) for {topBid.Amount:C}."
                        : $"Your item '{auction.Title}' closed with no bids.";
                    await notificationService.CreateAsync(auction.SellerId, sTitle, sMessage, auctionId: auction.Id);
                }
                catch (Exception exSellerNotif)
                {
                    _logger.LogError(exSellerNotif, "Failed to notify seller for auction {AuctionId}", auction.Id);
                }
            }

            await tx.CommitAsync(ct);

            // Broadcast that auction is closed so UIs can refresh
            try
            {
                await hub.Clients.All.SendAsync("AuctionClosed", new
                {
                    auction.Id,
                    WinnerId = auction.WinnerId,
                    CurrentPrice = auction.CurrentPrice,
                    auction.IsClosed
                }, ct);
            }
            catch (Exception exHub)
            {
                _logger.LogWarning(exHub, "Failed to broadcast AuctionClosed for auction {AuctionId}", auction.Id);
            }

            _logger.LogInformation("Auction id {AuctionId} closed. WinnerId: {WinnerId}", auction.Id, auction.WinnerId ?? "(none)");
        }
    }
}
