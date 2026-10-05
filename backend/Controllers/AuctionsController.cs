using System.Security.Claims;
using AuctionApi.Data;
using AuctionApi.Dtos;
using AuctionApi.Models;
using AuctionApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
namespace AuctionApi.Controllers;

[ApiController, Route("api/auctions")]
public class AuctionsController(ApplicationDbContext db, BidService bids, AuctionResolver resolver,
    AuctionEvents events, AuctionReconciler reconciler, AuctionSchedule schedule, TimeProvider clock) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) => Ok(await db.Auctions.AsNoTracking()
        .OrderByDescending(a => a.Id).Select(AuctionResponse.Select(clock.GetUtcNow())).ToListAsync(ct));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        var auction = await db.Auctions.AsNoTracking().Where(a => a.Id == id)
            .Select(AuctionResponse.Select(clock.GetUtcNow())).SingleOrDefaultAsync(ct);
        return auction == null ? NotFound(new { message = "Auction not found." }) : Ok(auction);
    }

    [HttpGet("latest")]
    public async Task<IActionResult> Latest(CancellationToken ct) => Ok(await db.Auctions.AsNoTracking()
        .Where(a => !a.IsClosed && a.Status != AuctionStatus.Draft).OrderByDescending(a => a.CreatedAt).Take(3)
        .Select(AuctionResponse.Select(clock.GetUtcNow())).ToListAsync(ct));

    [HttpGet("my"), Authorize]
    public async Task<IActionResult> My(CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        return Ok(await db.Auctions.AsNoTracking().Where(a => a.SellerId == userId || a.CreatedById == userId)
            .OrderByDescending(a => a.CreatedAt).Select(AuctionResponse.Select(clock.GetUtcNow())).ToListAsync(ct));
    }

    [HttpGet("{id:int}/result"), Authorize]
    public async Task<IActionResult> Result(int id, CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var auction = await db.Auctions.AsNoTracking().Where(a => a.Id == id).Select(a => new
        {
            a.Id, a.Title, a.IsClosed, a.ClosedAt, a.CurrentPrice,
            isWinner = a.IsClosed && a.WinnerId == userId, hasWinner = a.IsClosed && a.WinnerId != null,
            demoOnly = true
        }).SingleOrDefaultAsync(ct);
        return auction == null ? NotFound() : Ok(auction);
    }

    [HttpPost, Authorize]
    [HttpPost("/api/admin/auctions")]
    public async Task<IActionResult> Create(CreateAuctionDto dto, CancellationToken ct)
    {
        if (Request.Path.StartsWithSegments("/api/admin") && !User.IsInRole("Admin")) return Forbid();
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        if (!string.IsNullOrEmpty(dto.SellerId) && dto.SellerId != userId)
            return BadRequest(new { message = "You may only create auctions for yourself." });
        var validation = await ValidateAsync(dto, userId, ct);
        if (validation.Error != null) return BadRequest(new { message = validation.Error });
        var auction = new Auction
        {
            Title = dto.Title.Trim(), Description = dto.Description, StartPrice = dto.StartPrice,
            CurrentPrice = dto.StartPrice, ReservePrice = dto.ReservePrice,
            StartTime = dto.StartTime.ToUniversalTime(), EndTime = dto.EndTime.ToUniversalTime(),
            ImageUrl = validation.Asset?.SecureUrl, ImageAssetId = validation.Asset?.Id,
            SellerId = userId, CreatedById = userId, CreatedAt = clock.GetUtcNow().UtcDateTime,
            CategoryId = dto.CategoryId, Status = AuctionStatus.Scheduled
        };
        db.Auctions.Add(auction);
        await db.SaveChangesAsync(ct);
        Changed();
        var response = await db.Auctions.AsNoTracking().Where(a => a.Id == auction.Id)
            .Select(AuctionResponse.Select(clock.GetUtcNow())).SingleAsync(ct);
        await events.CreatedAsync(response);
        return CreatedAtAction(nameof(Get), new { id = auction.Id }, response);
    }

    [HttpPost("{id:int}/placebid"), Authorize, EnableRateLimiting("bids")]
    public async Task<IActionResult> PlaceBid(int id, PlaceBidDto dto, CancellationToken ct)
    {
        var result = await bids.PlaceAsync(id, User.FindFirstValue(ClaimTypes.NameIdentifier)!, dto.Amount, dto.RequestId, ct);
        return StatusCode(result.StatusCode, new { message = result.Message, id, auctionId = id,
            result.CurrentPrice, result.BidCount, result.BidId, time = result.Time });
    }

    [HttpPost("{id:int}/close"), Authorize(Roles = "Admin")]
    public async Task<IActionResult> Close(int id, CancellationToken ct)
    {
        var result = await resolver.ResolveAsync(id, force: true, ct: ct);
        Changed();
        return result.Found ? Ok(new { success = true, changed = result.Changed }) : NotFound();
    }

    internal async Task<(string? Error, ImageAsset? Asset)> ValidateAsync(CreateAuctionDto dto, string ownerId, CancellationToken ct,
        string? existingImage = null)
    {
        if (string.IsNullOrWhiteSpace(dto.Title) || dto.Title.Length > 200) return ("Enter a title of at most 200 characters.", null);
        if (!BidService.IsMoney(dto.StartPrice) || dto.StartPrice <= 0 ||
            (dto.ReservePrice != null && !BidService.IsMoney(dto.ReservePrice.Value)))
            return ("Prices must be positive amounts with at most two decimal places.", null);
        if (dto.StartTime == default || dto.EndTime <= dto.StartTime || dto.EndTime <= clock.GetUtcNow())
            return ("The end time must be after the start time and in the future.", null);
        if (dto.CategoryId != null && !await db.Categories.AnyAsync(c => c.Id == dto.CategoryId, ct))
            return ("Select a valid category.", null);
        if (string.IsNullOrEmpty(dto.ImageUrl) || dto.ImageUrl == existingImage) return (null, null);
        var asset = await db.ImageAssets.SingleOrDefaultAsync(i => i.OwnerId == ownerId && i.SecureUrl == dto.ImageUrl, ct);
        return asset == null ? ("Use an image uploaded by this account.", null) : (null, asset);
    }
    private void Changed() { reconciler.Invalidate(); schedule.Changed(); }
}
