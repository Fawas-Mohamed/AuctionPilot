using AuctionApi.Data;
using AuctionApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
namespace AuctionApi.Controllers;

public class DevelopmentOnlyAttribute : ActionFilterAttribute
{
    public override void OnActionExecuting(ActionExecutingContext context)
    {
        if (!context.HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment())
            context.Result = new NotFoundResult();
    }
}

[ApiController, Route("api/dev"), Authorize(Roles = "Admin"), DevelopmentOnly]
public class DevAuditController(ApplicationDbContext db, AuctionResolver resolver,
    AuctionReconciler reconciler, AuctionSchedule schedule) : ControllerBase
{
    [HttpGet("bids")]
    public async Task<IActionResult> Bids(CancellationToken ct) => Ok(await db.Bids.AsNoTracking()
        .OrderByDescending(b => b.Time).Take(200).Select(b => new { b.Id, b.AuctionId, b.Amount, b.Time }).ToListAsync(ct));
    [HttpGet("bidcounts")]
    public async Task<IActionResult> Counts(CancellationToken ct) => Ok(await db.Auctions.AsNoTracking()
        .Select(a => new { a.Id, a.Title, AuctionBidCount = a.BidCount, RealBidRows = a.Bids.Count, a.CurrentPrice, a.IsClosed }).ToListAsync(ct));
    [HttpGet("audit/{id:int}")]
    public async Task<IActionResult> Audit(int id, CancellationToken ct)
    {
        var auction = await db.Auctions.AsNoTracking().Where(a => a.Id == id)
            .Select(a => new { a.Id, a.Title, a.StartTime, a.EndTime, a.CurrentPrice, a.BidCount, a.IsClosed }).SingleOrDefaultAsync(ct);
        return auction == null ? NotFound() : Ok(new { auction });
    }
    [HttpPost("forceclose/{id:int}")]
    public async Task<IActionResult> ForceClose(int id, CancellationToken ct)
    {
        var result = await resolver.ResolveAsync(id, force: true, ct: ct);
        reconciler.Invalidate(); schedule.Changed();
        return result.Found ? Ok(new { changed = result.Changed }) : NotFound();
    }
}
