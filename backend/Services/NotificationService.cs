using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using AuctionApi.Data; 
using AuctionApi.Hubs;
using AuctionApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AuctionApi.Services
{
    public class NotificationService : INotificationService
    {
        private readonly ApplicationDbContext _db;
        private readonly IHubContext<AuctionHub> _hub;
        private readonly ILogger<NotificationService>? _logger;

        public NotificationService(ApplicationDbContext db, IHubContext<AuctionHub> hub, ILogger<NotificationService>? logger = null)
        {
            _db = db;
            _hub = hub;
            _logger = logger;
        }

        public async Task<Notification> CreateAsync(string userId, string title, string message, int? auctionId = null, int? bidId = null)
        {
            var n = new Notification
            {
                UserId = userId,
                Title = title,
                Message = message,
                AuctionId = auctionId,
                BidId = bidId
            };

            _db.Notifications.Add(n);
            await _db.SaveChangesAsync();

            var payload = new
            {
                n.Id,
                n.Title,
                n.Message,
                n.IsRead,
                n.CreatedAt,
                n.AuctionId,
                n.BidId
            };

            // send real-time to specific user (requires SignalR user mapping/claims)
            await SendRealtimeAsync(userId, payload);
            return n;
        }

        public async Task SendRealtimeAsync(string userId, object payload)
        {
            try
            {
                // Uses SignalR user feature. Ensure clients connect with auth token so Context.User.Identity.NameIdentifier is available.
                await _hub.Clients.User(userId).SendAsync("NotificationCreated", payload);
            }
            catch (System.Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to send realtime notification to user {UserId}", userId);
                // swallow so callers are not forced to handle SignalR failure
            }
        }
    }
}
