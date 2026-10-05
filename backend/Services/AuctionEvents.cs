using AuctionApi.Hubs;
using AuctionApi.Models;
using Microsoft.AspNetCore.SignalR;
namespace AuctionApi.Services;

public class AuctionEvents(IHubContext<AuctionHub> hub, ILogger<AuctionEvents> logger)
{
    public async Task BidAsync(Auction auction, Bid bid)
    {
        await SendAsync(() => hub.Clients.All.SendAsync("BidPlaced", new
        {
            id = auction.Id, auctionId = auction.Id, bidId = bid.Id,
            auction.CurrentPrice, auction.BidCount, amount = bid.Amount, time = bid.Time
        }));
    }

    public async Task ClosedAsync(Auction auction, IReadOnlyList<Notification> notifications)
    {
        await SendAsync(() => hub.Clients.All.SendAsync("AuctionClosed", new
        {
            id = auction.Id, auctionId = auction.Id, auction.CurrentPrice, auction.IsClosed,
            auction.ClosedAt, auction.Status, hasWinner = auction.WinnerId != null
        }));
        foreach (var n in notifications)
            await SendAsync(() => hub.Clients.User(n.UserId).SendAsync("NotificationCreated", new
            { n.Id, n.Title, n.Message, n.IsRead, n.CreatedAt, n.AuctionId, n.BidId }));
    }

    public Task CreatedAsync(object payload) => SendAsync(() => hub.Clients.All.SendAsync("AuctionCreated", payload));

    private async Task SendAsync(Func<Task> send)
    {
        try { await send(); }
        catch (Exception ex)
        {
            // The committed result remains successful. Reconnect clients fetch authoritative state.
            logger.LogWarning(ex, "Realtime delivery failed after commit; state is available through the API.");
        }
    }
}
