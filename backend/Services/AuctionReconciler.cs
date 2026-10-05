using AuctionApi.Data;
using Microsoft.EntityFrameworkCore;
namespace AuctionApi.Services;

// Singleton cache invalidated on creation/edit; no periodic database polling.
public class AuctionReconciler(IServiceScopeFactory scopes, TimeProvider clock)
{
    private readonly SemaphoreSlim gate = new(1);
    private DateTimeOffset? nextEnd;
    private bool known;
    private long revision;
    public void Invalidate() { Interlocked.Increment(ref revision); Volatile.Write(ref known, false); }
    public async Task<DateTimeOffset?> EnsureFreshAsync(CancellationToken ct = default)
    {
        await gate.WaitAsync(ct);
        try
        {
            if (known && (nextEnd == null || nextEnd > clock.GetUtcNow())) return nextEnd;
            var startedRevision = Interlocked.Read(ref revision);
            while (true)
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var due = await db.Auctions.AsNoTracking()
                    .Where(a => !a.IsClosed && a.EndTime <= clock.GetUtcNow())
                    .OrderBy(a => a.EndTime).Select(a => a.Id).Take(100).ToListAsync(ct);
                if (due.Count == 0) break;
                foreach (var id in due)
                {
                    using var closureScope = scopes.CreateScope();
                    await closureScope.ServiceProvider.GetRequiredService<AuctionResolver>().ResolveAsync(id, ct: ct);
                }
            }
            using var nextScope = scopes.CreateScope();
            var nextDb = nextScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            nextEnd = await nextDb.Auctions.AsNoTracking().Where(a => !a.IsClosed)
                .Select(a => (DateTimeOffset?)a.EndTime).MinAsync(ct);
            known = startedRevision == Interlocked.Read(ref revision);
            return nextEnd;
        }
        finally { gate.Release(); }
    }
}
