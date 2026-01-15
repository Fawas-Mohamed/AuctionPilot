using AuctionApi.Data;
using AuctionApi.Dtos;
using AuctionApi.Models;
using AuctionApi.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace AuctionApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class BidsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly UserManager<ApplicationUser> _um;
        private readonly IHubContext<AuctionHub> _hub;

        public BidsController(ApplicationDbContext db, UserManager<ApplicationUser> um, IHubContext<AuctionHub> hub)
        {
            _db = db;
            _um = um;
            _hub = hub;
        }

       

        [HttpGet("{auctionId}")]
        public async Task<IActionResult> GetBids(int auctionId)
        {
            var bids = await _db.Bids
                .Where(b => b.AuctionId == auctionId)
                .OrderByDescending(b => b.Time)
                .Include(b => b.Bidder)
                .Select(b => new { b.Id,b.Amount, b.Time, Bidder = b.Bidder.DisplayName })
                .ToListAsync();

            return Ok(bids);
        }

        [Authorize]
        [HttpGet("my-bids")]
        public async Task<IActionResult> MyBids()
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (userId == null) return Unauthorized();

            var bids = await _db.Bids
                .Where(b => b.BidderId == userId)
                .OrderByDescending(b => b.Time)
                .Include(b => b.Auction)
                .Select(b => new
                {
                    b.Id,
                    b.Amount,
                    b.Time,
                    AuctionId = b.Auction.Id,
                    AuctionTitle = b.Auction.Title
                })
                .Take(10) // latest 10 bids
                .ToListAsync();

            return Ok(bids);
        }

    }
}
