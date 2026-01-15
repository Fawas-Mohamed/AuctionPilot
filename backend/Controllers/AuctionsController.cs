using AuctionApi.Data;
using AuctionApi.Hubs;
using AuctionApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using AuctionApi.Utils;
using System;
using System.Threading.Tasks;
using System.Linq;

namespace AuctionApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuctionsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IHubContext<AuctionHub> _hub;
        private readonly UserManager<ApplicationUser> _userManager;

        public AuctionsController(
             ApplicationDbContext db,
             IHubContext<AuctionHub> hub,
             UserManager<ApplicationUser> userManager)
        {
            _db = db;
            _hub = hub;
            _userManager = userManager;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var auctions = await _db.Auctions
                .OrderByDescending(a => a.Id)
                .AsNoTracking()
                .ToListAsync();
            return Ok(auctions);
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            var auction = await _db.Auctions
                .Include(a => a.Bids)
                .Include(a => a.Seller)
                .Include(a => a.Category)
                .FirstOrDefaultAsync(a => a.Id == id);
            if (auction == null) return NotFound(new { message = "Auction not found" });
            return Ok(auction);
        }

        [HttpGet("latest")]
        public async Task<IActionResult> Get()
        {
            var auction =await _db.Auctions
                .Where(a => a.Status == AuctionStatus.Scheduled)
                .OrderByDescending (a => a.CreatedAt)
                .Take(3)
                .Select(a => new 
                {
                    a.Id,
                    a.Title,
                    a.Description,
                    a.CurrentPrice,
                    a.StartPrice,
                    a.StartTime,
                    a.EndTime,
                    a.ImageUrl,
                    a.Status,
                    Category = a.Category,
                    Bidcount = a.BidCount
                })
                .ToListAsync();
            return Ok(auction);

        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateAuctionDto dto)
        {
            if (dto == null) return BadRequest(new { message = "Invalid payload" });

            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var auction = new Auction
            {
                Title = dto.Title,
                Description = dto.Description,
                StartPrice = dto.StartPrice,
                CurrentPrice = dto.StartPrice,
                StartTime = TimeHelpers.EnsureUtc(dto.StartTime),
                EndTime = TimeHelpers.EnsureUtc(dto.EndTime),
                ImageUrl = dto.ImageUrl,
                CreatedById = userId,
                CreatedAt = DateTime.UtcNow,
                SellerId = dto.SellerId ?? userId,
                Status = AuctionStatus.Scheduled,
                CategoryId = dto.CategoryId
            };

            _db.Auctions.Add(auction);
            await _db.SaveChangesAsync();

            // broadcast to connected clients so everyone can update lists
            await _hub.Clients.All.SendAsync("AuctionCreated", new
            {
                auction.Id,
                auction.Title,
                auction.Description,
                auction.ImageUrl,
                auction.StartPrice,
                auction.CurrentPrice,
                auction.StartTime,
                auction.EndTime,
                auction.BidCount,
                auction.Status,
                auction.CreatedById,
                auction.CreatedAt,
                auction.CategoryId,
                auction.SellerId
            });

            return CreatedAtAction(nameof(Get), new { id = auction.Id }, auction);
        }

        // PlaceBid endpoint
        [HttpPost("{id}/placebid")]
        [Authorize]
        public async Task<IActionResult> PlaceBid(int id, [FromBody] PlaceBidDto dto)
        {
            if (dto == null) return BadRequest(new { message = "Invalid payload" });
            if (dto.Amount <= 0) return BadRequest(new { message = "Bid must be greater than 0" });

            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (userId == null) return Unauthorized();

            var auction = await _db.Auctions.FindAsync(id);
            if (auction == null) return NotFound(new { message = "Auction not found" });

            if (auction.IsClosed || auction.EndTime <= DateTime.UtcNow)

                return BadRequest(new { message = "Auction is already closed." });

            if (dto.Amount <= auction.CurrentPrice)
                return BadRequest(new { message = "Bid must be higher than current price", currentPrice = auction.CurrentPrice });

            // Use a transaction so Bid + Auction update are atomic
            using var tx = await _db.Database.BeginTransactionAsync();
            try
            {
                // create bid record (server-side time)
                var bid = new Bid
                {
                    AuctionId = auction.Id,
                    BidderId = userId,
                    Amount = dto.Amount,
                    Time = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow
                };

                // update auction fields
                auction.CurrentPrice = dto.Amount;
                auction.BidCount += 1;
                auction.WinnerId = userId;

                _db.Bids.Add(bid);
                _db.Auctions.Update(auction);

                await _db.SaveChangesAsync();
                await tx.CommitAsync();

                // broadcast update AFTER commit: send to group for this auction
                var groupName = $"auction-{auction.Id}";

                // Basic summary (array-like shape is also supported by front-end)
                await _hub.Clients.Group(groupName).SendAsync("BidPlaced", new
                {
                    id = auction.Id,
                    currentPrice = auction.CurrentPrice,
                    bidCount = auction.BidCount,
                    amount = bid.Amount,
                    bidderId = bid.BidderId,
                    time = bid.Time
                });

                // Also send a fuller update if you'd like
                await _hub.Clients.Group(groupName).SendAsync("AuctionUpdated", new
                {
                    id = auction.Id,
                    currentPrice = auction.CurrentPrice,
                    bidCount = auction.BidCount,
                    winnerId = auction.WinnerId,
                    endTime = auction.EndTime
                });

                return Ok(new
                {
                    auction.Id,
                    auction.CurrentPrice,
                    auction.BidCount,
                    amount = bid.Amount,
                    bidderId = bid.BidderId,
                    time = bid.Time
                });
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                Console.WriteLine($"Error placing bid: {ex}");
                return StatusCode(500, new { message = "Server error placing bid", detail = ex.Message });
            }
        }

        // GET: api/auctions/my
        // returns auctions created/listed by the current user (uses SellerId)
        [HttpGet("my")]
        [Authorize]
        public async Task<IActionResult> GetMyAuctions()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var auctions = await _db.Auctions
                .Where(a => a.SellerId == user.Id || a.CreatedById == user.Id)
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => new
                {
                    a.Id,
                    a.Title,
                    a.Status,
                    StartTime = a.StartTime,
                    EndTime = a.EndTime,
                    StartPrice = a.StartPrice,
                    CurrentPrice = a.CurrentPrice,
                    a.BidCount,
                    a.ImageUrl,
                    a.SellerId,
                    a.CreatedById,
                    a.CreatedAt,
                    a.CategoryId
                })
                .ToListAsync();

            return Ok(auctions);
        }

        [HttpPost("{id}/close")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> CloseAuction(int id)
        {
            var auction = await _db.Auctions.FindAsync(id);
            if (auction == null)
                return NotFound("Auction not found.");

            auction.IsClosed = true;
            await _db.SaveChangesAsync();

            // Notify clients that auction ended (use group)
            var groupName = $"auction-{id}";
            await _hub.Clients.Group(groupName).SendAsync("AuctionEnded", new
            {
                AuctionId = id,
                WinnerId = auction.WinnerId,
                FinalPrice = auction.CurrentPrice
            });

            return Ok(new { Success = true, Message = "Auction closed successfully." });
        }
    }

    // DTOs
    public record PlaceBidDto(decimal Amount);

    public class CreateAuctionDto
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public decimal StartPrice { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public string? ImageUrl { get; set; }

        public string? SellerId { get; set; }
        public int? CategoryId { get; set; }
    }
    
    }
   

    

