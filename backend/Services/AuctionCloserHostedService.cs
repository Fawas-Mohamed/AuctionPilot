namespace AuctionApi.Services;

public class AuctionCloserHostedService(AuctionReconciler reconciler, AuctionSchedule schedule,
    TimeProvider clock, ILogger<AuctionCloserHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var failures = 0;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var next = await reconciler.EnsureFreshAsync(stoppingToken);
                failures = 0;
                await schedule.WaitAsync(next == null ? null : next.Value - clock.GetUtcNow(), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Closure reconciliation unavailable; actionable requests retry it.");
                failures++;
                await schedule.WaitAsync(TimeSpan.FromSeconds(Math.Min(300, Math.Pow(2, Math.Min(failures, 8)))), stoppingToken);
            }
        }
    }
}
