// Controllers/DevAuditController.cs
using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using AuctionApi.Data;
using Microsoft.EntityFrameworkCore;

namespace AuctionApi.Controllers
{
    [ApiController]
    [Route("api/dev")]
    public class DevAuditController : ControllerBase
    {
        private readonly ApplicationDbContext _db;

        public DevAuditController(ApplicationDbContext db)
        {
            _db = db;
        }
        [HttpGet("bids")]
        public async Task<IActionResult> GetRecentBids()
        {
            var bids = await _db.Bids
                .AsNoTracking()
                .OrderByDescending(b => b.Time)
                .Take(200)
                .Select(b => new {
                    b.Id,
                    b.AuctionId,
                    b.BidderId,
                    b.Amount,
                    b.Time
                })
                .ToListAsync();

            return Ok(bids);
        }

        // GET /api/dev/db/bidcounts
        // Returns auctions with BidCount (from Auction) and RealBidRows (count in Bids table)
        [HttpGet("bidcounts")]
        public async Task<IActionResult> GetBidCounts()
        {
            var q = await _db.Auctions
                .AsNoTracking()
                .OrderByDescending(a => a.Id)
                .Select(a => new {
                    a.Id,
                    a.Title,
                    AuctionBidCount = a.BidCount,
                    RealBidRows = _db.Bids.Where(b => b.AuctionId == a.Id).Count(),
                    a.CurrentPrice,
                    a.IsClosed,
                    a.EndTime
                })
                .ToListAsync();

            return Ok(q);
        }
    
        // GET /api/dev/audit/{auctionId}
        // Returns auction, its bids (most recent first), and notifications referencing the auction.
        [HttpGet("audit/{auctionId:int}")]
        public async Task<IActionResult> AuditAuction(int auctionId)
        {
            var auction = await _db.Auctions
                .AsNoTracking()
                .Where(a => a.Id == auctionId)
                .Select(a => new {
                    a.Id,
                    a.Title,
                    a.StartTime,
                    a.EndTime,
                    a.CurrentPrice,
                    a.BidCount,
                    a.IsClosed,
                    a.WinnerId,
                    a.SellerId
                })
                .FirstOrDefaultAsync();

            if (auction == null) return NotFound(new { message = "Auction not found" });

            var bids = await _db.Bids
                .AsNoTracking()
                .Where(b => b.AuctionId == auctionId)
                .OrderByDescending(b => b.Time)
                .Select(b => new {
                    b.Id,
                    b.BidderId,
                    b.Amount,
                    b.Time
                })
                .ToListAsync();

            var notifications = await _db.Notifications
                .AsNoTracking()
                .Where(n => n.AuctionId == auctionId)
                .OrderByDescending(n => n.CreatedAt)
                .Select(n => new {
                    n.Id,
                    n.UserId,
                    n.Title,
                    n.Message,
                    n.AuctionId,
                    n.BidId,
                    n.CreatedAt
                })
                .ToListAsync();

            // return server-side UTC now so you can compare
            var serverUtcNow = DateTime.UtcNow;

            return Ok(new
            {
                ServerUtcNow = serverUtcNow,
                Auction = auction,
                Bids = bids,
                Notifications = notifications
            });
        }

        // POST /api/dev/forceclose/{auctionId}
        // Force-close an auction (useful for testing). This does NOT run the full resolver; it marks closed and returns.
        // NOTE: Use only in development/testing.
        [HttpPost("forceclose/{auctionId:int}")]
        public async Task<IActionResult> ForceClose(int auctionId)
        {
            var auction = await _db.Auctions.FindAsync(auctionId);
            if (auction == null) return NotFound(new { message = "Auction not found" });

            if (auction.IsClosed) return BadRequest(new { message = "Auction already closed" });

            auction.IsClosed = true;
            auction.EndTime = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return Ok(new { message = "Auction forced closed", auctionId = auctionId, ServerUtcNow = DateTime.UtcNow });
        }
    }
}
