using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System;
using System.Threading.Tasks;

namespace AuctionApi.Hubs
{
    [Authorize] 
    public class AuctionHub : Hub
    {
        public override async Task OnConnectedAsync()
        {
            var userId = Context.UserIdentifier;
            if (!string.IsNullOrEmpty(userId))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{userId}");
                Console.WriteLine($"? User connected to AuctionHub: {userId}");
            }

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = Context.UserIdentifier;
            if (!string.IsNullOrEmpty(userId))
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user-{userId}");
                Console.WriteLine($"? User disconnected from AuctionHub: {userId}");
            }

            await base.OnDisconnectedAsync(exception);
        }

        public async Task JoinAuctionRoom(string auctionId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"auction-{auctionId}");
            Console.WriteLine($"?? User joined auction room: {auctionId}");
        }

        public async Task LeaveAuctionRoom(string auctionId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"auction-{auctionId}");
            Console.WriteLine($"?? User left auction room: {auctionId}");
        }

        /// <summary>
        /// Used by the server to broadcast a new bid to users in a specific auction.
        /// </summary>
        public async Task BroadcastBidPlaced(string auctionId, object bidInfo)
        {
            await Clients.Group($"auction-{auctionId}").SendAsync("BidPlaced", bidInfo);
        }

        /// <summary>
        /// Used by the server to broadcast auction winner / end notification.
        /// </summary>
        public async Task BroadcastAuctionEnded(string auctionId, object result)
        {
            await Clients.Group($"auction-{auctionId}").SendAsync("AuctionEnded", result);
        }
    }
}
