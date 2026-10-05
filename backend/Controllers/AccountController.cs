using System.Security.Claims;
using AuctionApi.Data;
using AuctionApi.Models;
using AuctionApi.Services;
using AuctionApi.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
namespace AuctionApi.Controllers;

[ApiController, Route("api/account"), Authorize]
public class AccountController(UserManager<ApplicationUser> users, ApplicationDbContext db,
    ImageAssetService images, TimeProvider clock) : ControllerBase
{
    private object Profile(ApplicationUser user) => new { id = user.Id, name = user.DisplayName ?? user.UserName,
        email = user.Email, phone = user.PhoneNumber, avatarUrl = user.AvatarUrl, memberSince = user.CreatedAt };
    [HttpGet("profile")]
    public async Task<IActionResult> GetProfile()
    {
        var user = await users.GetUserAsync(User);
        return user == null ? Unauthorized() : Ok(Profile(user));
    }
    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile(UpdateProfileDto dto, CancellationToken ct)
    {
        var user = await users.GetUserAsync(User);
        if (user == null) return Unauthorized();
        if (dto.Name?.Length > 100 || dto.PhoneNumber?.Length > 30) return BadRequest(new { message = "Profile values are too long." });
        if (dto.AvatarUrl != null && dto.AvatarUrl != user.AvatarUrl)
        {
            var asset = await db.ImageAssets.SingleOrDefaultAsync(i => i.OwnerId == user.Id && i.SecureUrl == dto.AvatarUrl, ct);
            if (asset == null) return BadRequest(new { message = "Use an avatar uploaded by this account." });
            user.AvatarUrl = asset.SecureUrl; user.AvatarAssetId = asset.Id;
        }
        user.DisplayName = dto.Name ?? user.DisplayName;
        user.PhoneNumber = dto.PhoneNumber ?? user.PhoneNumber;
        var result = await users.UpdateAsync(user);
        return result.Succeeded ? Ok(Profile(user)) : BadRequest(result.Errors);
    }
    [HttpGet("stats")]
    public async Task<IActionResult> Stats(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var won = db.Auctions.AsNoTracking().Where(a => a.IsClosed && a.WinnerId == userId);
        var wonCount = await won.CountAsync(ct);
        var winningTotal = await won.SumAsync(a => (decimal?)a.CurrentPrice, ct) ?? 0;
        var watched = await db.Watchlists.CountAsync(w => w.UserId == userId, ct);
        var now = clock.GetUtcNow();
        var active = await db.Bids.Where(b => b.BidderId == userId && !b.Auction.IsClosed &&
            b.Auction.StartTime <= now && b.Auction.EndTime > now).Select(b => b.AuctionId).Distinct().CountAsync(ct);
        return Ok(new[]
        {
            new { label = "Demo Auctions Won", value = wonCount.ToString() },
            new { label = "Demo Winning Total", value = $"LKR {winningTotal:N0}" },
            new { label = "Items Watched", value = watched.ToString() },
            new { label = "Active Bids", value = active.ToString() }
        });
    }
    [HttpPost("avatar"), EnableRateLimiting("uploads"), Consumes("multipart/form-data")]
    [RequestSizeLimit(ImageUploadValidation.MaxBytes + 65536)]
    [RequestFormLimits(MultipartBodyLengthLimit = ImageUploadValidation.MaxBytes + 65536)]
    public async Task<IActionResult> UploadAvatar([FromForm] IFormFile file, CancellationToken ct)
    {
        var user = await users.GetUserAsync(User);
        if (user == null) return Unauthorized();
        try
        {
            var asset = await images.UploadAsync(file, user.Id, ct);
            user.AvatarUrl = asset.SecureUrl;
            user.AvatarAssetId = asset.Id;
            var result = await users.UpdateAsync(user);
            if (!result.Succeeded) return StatusCode(502, new { message = "Avatar could not be saved." });
            return Ok(new { avatarUrl = user.AvatarUrl, assetId = asset.Id });
        }
        catch (InvalidImageException ex) { return BadRequest(new { message = ex.Message }); }
        catch (ImageStorageException ex) { return StatusCode(502, new { message = ex.Message }); }
    }
}
public record UpdateProfileDto(string? Name, string? PhoneNumber, string? AvatarUrl);
