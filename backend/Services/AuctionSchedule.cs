using System.Threading.Channels;
namespace AuctionApi.Services;

public class AuctionSchedule
{
    private readonly Channel<bool> changes = Channel.CreateBounded<bool>(new BoundedChannelOptions(1)
        { FullMode = BoundedChannelFullMode.DropWrite });
    public void Changed() => changes.Writer.TryWrite(true);
    public async Task WaitAsync(TimeSpan? delay, CancellationToken ct)
    {
        if (delay == null) { await changes.Reader.ReadAsync(ct); return; }
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct);
        var changed = changes.Reader.ReadAsync(linked.Token).AsTask();
        var wait = delay.Value > TimeSpan.Zero ? delay.Value : TimeSpan.Zero;
        // Task.Delay cannot accept more than its unsigned millisecond range.
        if (wait.TotalMilliseconds > uint.MaxValue - 1) wait = TimeSpan.FromMilliseconds(uint.MaxValue - 1);
        var timer = Task.Delay(wait, linked.Token);
        try { await await Task.WhenAny(changed, timer); }
        finally { linked.Cancel(); }
    }
}
