using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using AuctionApi.Data;  
using AuctionApi.Hubs;  
using AuctionApi.Models; 

namespace AuctionApi.Services
{
    public class AuctionResolver
    {
        private readonly ApplicationDbContext _db;
        private readonly INotificationService _notificationService;
        private readonly IHubContext<AuctionHub> _hub;
        private readonly ILogger<AuctionResolver>? _logger;

        public AuctionResolver(
            ApplicationDbContext db,
            INotificationService notificationService,
            IHubContext<AuctionHub> hub,
            ILogger<AuctionResolver>? logger = null)
        {
            _db = db;
            _notificationService = notificationService;
            _hub = hub;
            _logger = logger;
        }

        public async Task ResolveAsync(int auctionId, CancellationToken ct = default)
        {
            await using var tx = await _db.Database.BeginTransactionAsync(ct);

            var auction = await _db.Auctions
                .Include(a => a.Bids)
                .FirstOrDefaultAsync(a => a.Id == auctionId, ct);

            if (auction == null)
            {
                _logger?.LogWarning("Auction {AuctionId} not found during resolve.", auctionId);
                await tx.RollbackAsync(ct);
                return;
            }

            if (auction.IsClosed)
            {
                _logger?.LogDebug("Auction {AuctionId} already closed.", auctionId);
                await tx.RollbackAsync(ct);
                return;
            }

            var topBid = await _db.Bids
                .Where(b => b.AuctionId == auctionId)
                .OrderByDescending(b => b.Amount)
                .ThenBy(b => b.Time)
                .FirstOrDefaultAsync(ct);

            if (topBid != null)
            {
                auction.WinnerId = topBid.BidderId;
            }

            auction.IsClosed = true;
            // NOTE: intentionally not assigning auction.ClosedAt or auction.Status to avoid mismatches

            await _db.SaveChangesAsync(ct);

            // Send/create notifications
            if (topBid != null && !string.IsNullOrEmpty(topBid.BidderId))
            {
                try
                {
                    var title = "You won an auction!";
                    var message = $"You won '{auction.Title}' with a bid of {topBid.Amount:C} (Auction #{auction.Id}).";
                    await _notificationService.CreateAsync(topBid.BidderId, title, message, auctionId: auction.Id, bidId: topBid.Id);
                }
                catch (Exception ex)
                {
                    _logger?.LogError(ex, "Failed to create winner notification for auction {AuctionId}", auction.Id);
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
                    await _notificationService.CreateAsync(auction.SellerId, sTitle, sMessage, auctionId: auction.Id);
                }
                catch (Exception ex)
                {
                    _logger?.LogError(ex, "Failed to notify seller for auction {AuctionId}", auction.Id);
                }
            }

            await tx.CommitAsync(ct);

            // broadcast final state
            try
            {
                await _hub.Clients.All.SendAsync("AuctionClosed", new
                {
                    auction.Id,
                    WinnerId = auction.WinnerId,
                    CurrentPrice = auction.CurrentPrice,
                    auction.IsClosed
                }, ct);
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to send AuctionClosed hub message for auction {AuctionId}", auction.Id);
            }

            _logger?.LogInformation("Resolved auction {AuctionId}. Winner: {Winner}", auction.Id, auction.WinnerId ?? "(none)");
        }
    }
}
