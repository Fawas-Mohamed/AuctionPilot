using System.Security.Claims;
using AuctionApi.Data;
using AuctionApi.Dtos;
using AuctionApi.Models;
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
        .OrderByDescending(a => a.Id).Select(AuctionResponse.Select(clock.GetUtcNow(), includeReservePrice: true)).ToListAsync(ct));
    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        var result = await db.Auctions.AsNoTracking().Where(a => a.Id == id)
            .Select(AuctionResponse.Select(clock.GetUtcNow(), includeReservePrice: true)).SingleOrDefaultAsync(ct);
        return result == null ? NotFound() : Ok(result);
    }
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, AdminUpdateAuctionDto dto, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var auction = await db.Auctions.FromSqlInterpolated(
            $"""SELECT *, xmin FROM "Auctions" WHERE "Id" = {id} FOR UPDATE""").SingleOrDefaultAsync(ct);
        if (auction == null) return NotFound();
        var validator = new AuctionsController(db, bids, resolver, events, reconciler, schedule, clock);
        var validation = await validator.ValidateAsync(dto, User.FindFirstValue(ClaimTypes.NameIdentifier)!, ct, auction.ImageUrl, allowPastEnd: true);
        if (validation.Error != null) return BadRequest(new { message = validation.Error });
        var now = clock.GetUtcNow();
        if (dto.Reopen && dto.EndTime <= now)
            return BadRequest(new { message = "Choose a future end time to reopen the auction." });
        auction.Title = dto.Title.Trim();
        auction.Description = dto.Description;
        auction.StartPrice = dto.StartPrice;
        var highestBid = await db.Bids.Where(b => b.AuctionId == id).Select(b => (decimal?)b.Amount).MaxAsync(ct);
        auction.CurrentPrice = Math.Max(dto.StartPrice, highestBid ?? dto.StartPrice);
        auction.BidCount = await db.Bids.CountAsync(b => b.AuctionId == id, ct);
        auction.ReservePrice = dto.ReservePrice;
        auction.StartTime = dto.StartTime.ToUniversalTime();
        auction.EndTime = dto.EndTime.ToUniversalTime();
        auction.CategoryId = dto.CategoryId;
        if (validation.Asset != null) { auction.ImageAssetId = validation.Asset.Id; auction.ImageUrl = validation.Asset.SecureUrl; }
        else if (string.IsNullOrEmpty(dto.ImageUrl)) { auction.ImageAssetId = null; auction.ImageUrl = null; }
        if (dto.Reopen)
        {
            auction.IsClosed = false;
            auction.ClosedAt = null;
            auction.WinnerId = auction.WinnerUserId = null;
            await db.Notifications.Where(n => n.AuctionId == id && (n.EventKind == "winner" || n.EventKind == "seller"))
                .ExecuteDeleteAsync(ct);
            // A reopened demo auction no longer has a final result for a pending order.
            await db.Orders.Where(o => o.AuctionId == id && o.Status == "PendingPayment")
                .ExecuteUpdateAsync(set => set.SetProperty(o => o.Status, "Cancelled"), ct);
        }
        IReadOnlyList<Notification>? notifications = null;
        if (auction.IsClosed || auction.EndTime <= now)
            notifications = await resolver.CloseLockedAsync(auction, now, ct);
        else
            auction.Status = auction.StartTime > now ? AuctionStatus.Scheduled : AuctionStatus.Live;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        Changed();
        if (notifications != null) await events.ClosedAsync(auction, notifications);
        var response = await db.Auctions.AsNoTracking().Where(a => a.Id == id)
            .Select(AuctionResponse.Select(clock.GetUtcNow())).SingleAsync(ct);
        await events.UpdatedAsync(response);
        return await Get(id, ct);
    }
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var auction = await db.Auctions.FromSqlInterpolated(
            $"""SELECT *, xmin FROM "Auctions" WHERE "Id" = {id} FOR UPDATE""").SingleOrDefaultAsync(ct);
        if (auction == null) return NotFound();
        // Keep the same lock as bidding/closure and delete dependent rows in this transaction.
        await db.Notifications.Where(n => n.AuctionId == id ||
            db.Bids.Any(b => b.AuctionId == id && b.Id == n.BidId)).ExecuteDeleteAsync(ct);
        await db.Orders.Where(o => o.AuctionId == id).ExecuteDeleteAsync(ct);
        await db.Bids.Where(b => b.AuctionId == id).ExecuteDeleteAsync(ct);
        await db.Watchlists.Where(w => w.AuctionId == id).ExecuteDeleteAsync(ct);
        db.Auctions.Remove(auction);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        // The Cloudinary asset stays in ImageAssets for manual retention/cleanup.
        Changed();
        await events.DeletedAsync(id);
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
