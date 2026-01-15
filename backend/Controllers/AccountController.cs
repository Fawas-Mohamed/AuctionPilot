// Controllers/AccountController.cs
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AuctionApi.Data;
using AuctionApi.Models;

namespace AuctionApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AccountController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ApplicationDbContext _db;

        public AccountController(UserManager<ApplicationUser> userManager, ApplicationDbContext db)
        {
            _userManager = userManager;
            _db = db;
        }

        // GET: api/account/profile
        [HttpGet("profile")]
        [Authorize]
        public async Task<IActionResult> GetProfile()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            return Ok(new
            {
                id = user.Id,
                name = user.DisplayName ?? user.UserName,
                email = user.Email,
                phone = user.PhoneNumber,        
                avatarUrl = user.AvatarUrl,      
                memberSince = user.CreatedAt     
            });
        }

        // PUT: api/account/profile
        [HttpPut("profile")]
        [Authorize]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            user.DisplayName = dto.Name ?? user.DisplayName;
            user.PhoneNumber = dto.PhoneNumber ?? user.PhoneNumber; 
            user.AvatarUrl = dto.AvatarUrl ?? user.AvatarUrl;

            var result = await _userManager.UpdateAsync(user);
            if (!result.Succeeded) return BadRequest(result.Errors);

            // ✅ optionally return updated profile so frontend gets it instantly
            return Ok(new
            {
                id = user.Id,
                name = user.DisplayName,
                email = user.Email,
                phone = user.PhoneNumber,
                avatarUrl = user.AvatarUrl,
                memberSince = user.CreatedAt
            });
        }

        // GET: api/account/stats
        [HttpGet("stats")]
        [Authorize]
        public async Task<IActionResult> GetStats()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var won = 0;
            if (_db.Set<Auction>() != null)
            {
                won = await _db.Auctions.CountAsync(a => a.WinnerId == user.Id);
            }

            var totalSpent = 0m;
            if (_db.Set<Bid>() != null)
            {
                totalSpent = await _db.Bids
                    .Where(b => b.BidderId == user.Id && b.Auction != null && b.Auction.WinnerId == user.Id)
                    .SumAsync(b => (decimal?)b.Amount) ?? 0m;
            }

            var watched = 0;
            if (_db.Set<WatchlistItem>() != null)
            {
                watched = await _db.Set<WatchlistItem>().CountAsync(w => w.UserId == user.Id);
            }

            var activeBids = 0;
            if (_db.Set<Bid>() != null)
            {
                activeBids = await _db.Bids
                    .Where(b => b.BidderId == user.Id && b.Auction != null && b.Auction.Status == AuctionStatus.Live)
                    .CountAsync();
            }

            var result = new[]
            {
                new { label = "Auctions Won", value = won.ToString() },
                new { label = "Total Spent", value = $"${totalSpent:N0}" },
                new { label = "Items Watched", value = watched.ToString() },
                new { label = "Active Bids", value = activeBids.ToString() }
            };

            return Ok(result);
        }
        [Authorize]
        [HttpPost("avatar")]
        public async Task<IActionResult> UploadAvatar(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file");

            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var uploadsPath = Path.Combine("wwwroot", "uploads");
            Directory.CreateDirectory(uploadsPath);

            var fileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
            var filePath = Path.Combine(uploadsPath, fileName);

            using var stream = new FileStream(filePath, FileMode.Create);
            await file.CopyToAsync(stream);

            user.AvatarUrl = $"/uploads/{fileName}";
            await _userManager.UpdateAsync(user);

            return Ok(new { avatarUrl = user.AvatarUrl });
        }

    }

    public record UpdateProfileDto(string? Name, string? PhoneNumber, string? AvatarUrl);

    public class WatchlistItem
    {
        public int Id { get; set; }
        public string UserId { get; set; } = default!;
        public int AuctionId { get; set; }
    }
}
