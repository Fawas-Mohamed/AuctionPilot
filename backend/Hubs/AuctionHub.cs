using AuctionApi.Data;
using AuctionApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
namespace AuctionApi.Hubs;

[Authorize]
public class AuctionHub(ApplicationDbContext db, AuctionReconciler reconciler) : Hub
{
    // Only group membership is client-callable. All auction events originate after server commits.
    public async Task JoinAuctionRoom(string auctionId)
    {
        if (!int.TryParse(auctionId, out var id) || id <= 0) throw new HubException("Invalid auction.");
        await reconciler.EnsureFreshAsync(Context.ConnectionAborted);
        if (!await db.Auctions.AsNoTracking().AnyAsync(a => a.Id == id, Context.ConnectionAborted))
            throw new HubException("Auction not found.");
        await Groups.AddToGroupAsync(Context.ConnectionId, $"auction-{id}");
    }
    public Task LeaveAuctionRoom(string auctionId)
    {
        if (!int.TryParse(auctionId, out var id) || id <= 0) throw new HubException("Invalid auction.");
        return Groups.RemoveFromGroupAsync(Context.ConnectionId, $"auction-{id}");
    }
}
