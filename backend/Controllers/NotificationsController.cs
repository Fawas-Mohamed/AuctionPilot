// Controllers/NotificationsController.cs
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AuctionApi.Data;
using Microsoft.EntityFrameworkCore;

namespace AuctionApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class NotificationsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;

        public NotificationsController(ApplicationDbContext db)
        {
            _db = db;
        }

        // GET: api/notifications
        [HttpGet]
        [Authorize]
        public async Task<IActionResult> GetMyNotifications()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var notifs = await _db.Notifications
                .Where(n => n.UserId == userId)
                .OrderByDescending(n => n.CreatedAt)
                .Take(100)
                .Select(n => new
                {
                    n.Id,
                    n.Title,
                    n.Message,
                    n.IsRead,
                    n.CreatedAt,
                    n.AuctionId,
                    n.BidId
                })
                .ToListAsync();

            return Ok(notifs);
        }

        // POST: api/notifications/{id}/read
        [HttpPost("{id:int}/read")]
        [Authorize]
        public async Task<IActionResult> MarkAsRead(int id)
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var notif = await _db.Notifications.FindAsync(id);
            if (notif == null || notif.UserId != userId) return NotFound();

            notif.IsRead = true;
            await _db.SaveChangesAsync();
            return Ok();
        }
    }
}
