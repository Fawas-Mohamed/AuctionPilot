using AuctionApi.Data;
using AuctionApi.Hubs;
using AuctionApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AuctionApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class WatchlistController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<AuctionHub> _hub;

        public WatchlistController(ApplicationDbContext context, IHubContext<AuctionHub> hub)
        {
            _context = context;
            _hub = hub;
        }

        /// <summary>
        /// Attempts to find the user id from common JWT claim names.
        /// </summary>
        private string? GetUserIdFromClaims()
        {
            // Try common claim names in order of preference
            return User.FindFirst("sub")?.Value
                ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("nameid")?.Value
                ?? User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
        }

        // POST: api/watchlist/{auctionId}
        [HttpPost("{auctionId}")]
        public async Task<IActionResult> AddToWatchlist(int auctionId)
        {
            var userId = GetUserIdFromClaims();
            if (string.IsNullOrEmpty(userId)) return Unauthorized(new { message = "Not authorized. Please login." });

            var exists = await _context.Watchlists
                .AnyAsync(w => w.AuctionId == auctionId && w.UserId == userId);

            if (exists) return BadRequest(new { message = "Already in watchlist" });

            var item = new Watchlist
            {
                AuctionId = auctionId,
                UserId = userId
            };

            _context.Watchlists.Add(item);
            await _context.SaveChangesAsync();

            // notify this user's connected SignalR clients (if any)
            try
            {
                await _hub.Clients.User(userId).SendAsync("WatchlistChanged", auctionId, true);
            }
            catch
            {
                // don't fail the API if SignalR notify fails; just log in real app
            }

            return Ok(new { id = item.Id, auctionId = item.AuctionId });
        }

        // DELETE: api/watchlist/{auctionId}
        [HttpDelete("{auctionId}")]
        public async Task<IActionResult> RemoveFromWatchlist(int auctionId)
        {
            var userId = GetUserIdFromClaims();
            if (string.IsNullOrEmpty(userId)) return Unauthorized(new { message = "Not authorized. Please login." });

            var item = await _context.Watchlists
                .FirstOrDefaultAsync(w => w.AuctionId == auctionId && w.UserId == userId);

            if (item == null) return NotFound(new { message = "Item not found in watchlist" });

            _context.Watchlists.Remove(item);
            await _context.SaveChangesAsync();

            // notify this user's connected SignalR clients (if any)
            try
            {
                await _hub.Clients.User(userId).SendAsync("WatchlistChanged", auctionId, false);
            }
            catch
            {
                // swallow notify errors
            }

            return NoContent();
        }

        // GET: api/watchlist
        [HttpGet]
        public async Task<IActionResult> GetWatchlist()
        {
            var userId = GetUserIdFromClaims();
            if (string.IsNullOrEmpty(userId)) return Unauthorized(new { message = "Not authorized. Please login." });

            var items = await _context.Watchlists
                .Where(w => w.UserId == userId)
                .Include(w => w.Auction)
                .Select(w => new
                {
                    w.Id,
                    w.AuctionId,
                    Auction = new
                    {
                        w.Auction.Id,
                        w.Auction.Title,
                        ImageUrl = w.Auction.ImageUrl,
                        w.Auction.CurrentPrice,
                        w.Auction.StartPrice,
                        w.Auction.EndTime
                    }
                })
                .ToListAsync();

            return Ok(items);
        }
    }
}
