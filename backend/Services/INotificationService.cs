// Services/INotificationService.cs
using System.Threading.Tasks;
using AuctionApi.Models;

namespace AuctionApi.Services
{
    public interface INotificationService
    {
        Task<Notification> CreateAsync(string userId, string title, string message, int? auctionId = null, int? bidId = null);
        Task SendRealtimeAsync(string userId, object payload);
    }
}
