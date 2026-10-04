using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Npgsql;
namespace AuctionApi.Services;

public class AuctionFreshnessFilter(AuctionReconciler reconciler, ILogger<AuctionFreshnessFilter> logger) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var path = context.HttpContext.Request.Path.Value?.ToLowerInvariant() ?? "";
        if (HttpMethods.IsGet(context.HttpContext.Request.Method) &&
            (path.Contains("auctions") || path.Contains("bids") || path.Contains("watchlist") ||
             path.Contains("notifications") || path.EndsWith("/account/stats") || path.Contains("/admin/reports")))
        {
            try { await reconciler.EnsureFreshAsync(context.HttpContext.RequestAborted); }
            catch (Exception ex) when (ex is NpgsqlException or DbUpdateException or TimeoutException)
            {
                logger.LogWarning(ex, "Auction reconciliation failed.");
                context.Result = new ObjectResult(new { message = "Auction state is temporarily unavailable. Please retry." }) { StatusCode = 503 };
                return;
            }
        }
        await next();
    }
}
