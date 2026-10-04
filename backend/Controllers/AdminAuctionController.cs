using System.Security.Claims;
using AuctionApi.Data;
using AuctionApi.Dtos;
using AuctionApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
namespace AuctionApi.Controllers;

[ApiController, Route("api/admin/auctions"), Authorize(Roles = "Admin")]
public class AdminAuctionsController(ApplicationDbContext db, AuctionResolver resolver, AuctionEvents events,
    BidService bids, AuctionReconciler reconciler, AuctionSchedule schedule, TimeProvider clock) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) => Ok(await db.Auctions.AsNoTracking()
        .OrderByDescending(a => a.Id).Select(AuctionResponse.Select(clock.GetUtcNow())).ToListAsync(ct));
    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        var result = await db.Auctions.AsNoTracking().Where(a => a.Id == id)
            .Select(AuctionResponse.Select(clock.GetUtcNow())).SingleOrDefaultAsync(ct);
        return result == null ? NotFound() : Ok(result);
    }
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, CreateAuctionDto dto, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var auction = await db.Auctions.FromSqlInterpolated(
            $"""SELECT *, xmin FROM "Auctions" WHERE "Id" = {id} FOR UPDATE""").SingleOrDefaultAsync(ct);
        if (auction == null) return NotFound();
        if (auction.IsClosed || auction.StartTime <= clock.GetUtcNow() || await db.Bids.AnyAsync(b => b.AuctionId == id, ct))
            return Conflict(new { message = "Only an unstarted auction without bids can be edited." });
        var validator = new AuctionsController(db, bids, resolver, events, reconciler, schedule, clock);
        var validation = await validator.ValidateAsync(dto, User.FindFirstValue(ClaimTypes.NameIdentifier)!, ct, auction.ImageUrl);
        if (validation.Error != null) return BadRequest(new { message = validation.Error });
        auction.Title = dto.Title.Trim();
        auction.Description = dto.Description;
        auction.StartPrice = dto.StartPrice;
        auction.CurrentPrice = dto.StartPrice;
        auction.ReservePrice = dto.ReservePrice;
        auction.StartTime = dto.StartTime.ToUniversalTime();
        auction.EndTime = dto.EndTime.ToUniversalTime();
        auction.CategoryId = dto.CategoryId;
        if (validation.Asset != null) { auction.ImageAssetId = validation.Asset.Id; auction.ImageUrl = validation.Asset.SecureUrl; }
        else if (string.IsNullOrEmpty(dto.ImageUrl)) { auction.ImageAssetId = null; auction.ImageUrl = null; }
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        Changed();
        return await Get(id, ct);
    }
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var auction = await db.Auctions.FromSqlInterpolated(
            $"""SELECT *, xmin FROM "Auctions" WHERE "Id" = {id} FOR UPDATE""").SingleOrDefaultAsync(ct);
        if (auction == null) return NotFound();
        if (auction.IsClosed || auction.StartTime <= clock.GetUtcNow() || await db.Bids.AnyAsync(b => b.AuctionId == id, ct))
            return Conflict(new { message = "Auction history must be retained; only unstarted auctions without bids can be deleted." });
        await db.Watchlists.Where(w => w.AuctionId == id).ExecuteDeleteAsync(ct);
        db.Auctions.Remove(auction);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        // The Cloudinary asset stays in ImageAssets for manual retention/cleanup.
        Changed();
        return NoContent();
    }
    [HttpPatch("{id:int}/close")]
    public async Task<IActionResult> Close(int id, CancellationToken ct)
    {
        var result = await resolver.ResolveAsync(id, force: true, ct: ct);
        Changed();
        return result.Found ? Ok(new { success = true, changed = result.Changed }) : NotFound();
    }
    private void Changed() { reconciler.Invalidate(); schedule.Changed(); }
}
