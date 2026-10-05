using AuctionApi.Models;
using AuctionApi.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;
namespace AuctionApi.Tests;

public class PostgresAuctionTests : PostgresDatabase
{
    [PostgresFact]
    public async Task Integration_fixture_uses_Npgsql_and_a_real_migrated_PostgreSQL_server()
    {
        await using var db = NewContext();
        Assert.True(db.Database.IsNpgsql());
        await using var connection = db.Database.GetDbConnection();
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT version()";
        Assert.StartsWith("PostgreSQL ", (string)(await command.ExecuteScalarAsync())!);
        var migrations = (await db.Database.GetAppliedMigrationsAsync()).ToArray();
        Assert.Contains(migrations, m => m.EndsWith("_InitialPostgreSqlDemo"));
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
    }

    [PostgresFact]
    public async Task Competing_bids_are_serialized_and_highest_price_is_persisted()
    {
        var id = await AuctionAsync();
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var tasks = Enumerable.Range(11, 20).Select(async amount =>
        { await gate.Task; return await BidAsync(id, amount % 2 == 0 ? "bidder-a" : "bidder-b", amount); }).ToArray();
        gate.SetResult(); var results = await Task.WhenAll(tasks);
        Assert.All(results, r => Assert.Contains(r.StatusCode, new[] { 200, 409 }));
        await using var db = NewContext();
        var auction = await db.Auctions.SingleAsync();
        var stored = await db.Bids.ToListAsync();
        Assert.Equal(30m, auction.CurrentPrice);
        Assert.Equal(stored.Count, auction.BidCount);
        Assert.Equal(results.Count(r => r.StatusCode == 200), stored.Count);
        Assert.Null(auction.WinnerId);
    }
    [PostgresFact]
    public async Task Equal_competing_bids_accept_exactly_one()
    {
        var id = await AuctionAsync();
        var result = await Task.WhenAll(Enumerable.Range(0, 12).Select(i => BidAsync(id, i % 2 == 0 ? "bidder-a" : "bidder-b", 20)));
        Assert.Single(result, r => r.StatusCode == 200);
        await using var db = NewContext(); Assert.Equal(1, await db.Bids.CountAsync());
    }
    [PostgresFact]
    public async Task Replayed_request_is_exactly_once_even_after_closure()
    {
        var id = await AuctionAsync(); var key = Guid.NewGuid();
        var results = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => BidAsync(id, "bidder-a", 20, key)));
        Assert.All(results, r => Assert.Equal(200, r.StatusCode));
        Assert.Single(results.Select(r => r.BidId).Distinct());
        await CloseAsync(id);
        Assert.Equal(200, (await BidAsync(id, "bidder-a", 20, key)).StatusCode);
        Assert.Equal(409, (await BidAsync(id, "bidder-a", 25, key)).StatusCode);
        await using var db = NewContext(); Assert.Equal(1, await db.Bids.CountAsync());
    }
    [PostgresFact]
    public async Task Bid_that_holds_lock_first_commits_before_closure_selects_winner()
    {
        var id = await AuctionAsync();
        var blocker = new BlockingSaveInterceptor(whenClosing: false);
        await using var bidDb = NewContext(blocker);
        var bid = new BidService(bidDb, Events(), Clock).PlaceAsync(id, "bidder-a", 20, Guid.NewGuid());
        await blocker.Entered.Task.WaitAsync(TimeSpan.FromSeconds(10));
        var close = CloseAsync(id);
        await Task.Delay(150); Assert.False(close.IsCompleted);
        blocker.Release.SetResult();
        Assert.Equal(200, (await bid).StatusCode); Assert.True((await close).Changed);
        await using var check = NewContext();
        var auction = await check.Auctions.SingleAsync(); Assert.Equal("bidder-a", auction.WinnerId); Assert.Equal(1, auction.BidCount);
    }
    [PostgresFact]
    public async Task Closure_that_holds_lock_first_rejects_concurrent_bid()
    {
        var id = await AuctionAsync();
        var blocker = new BlockingSaveInterceptor(whenClosing: true);
        await using var closeDb = NewContext(blocker);
        var close = new AuctionResolver(closeDb, Events(), Clock).ResolveAsync(id, force: true);
        await blocker.Entered.Task.WaitAsync(TimeSpan.FromSeconds(10));
        var bid = BidAsync(id, "bidder-a", 20);
        await Task.Delay(150); Assert.False(bid.IsCompleted);
        blocker.Release.SetResult();
        Assert.True((await close).Changed); Assert.Equal(409, (await bid).StatusCode);
        await using var check = NewContext(); Assert.Equal(0, await check.Bids.CountAsync());
    }
    [PostgresFact]
    public async Task Bid_checks_server_time_after_waiting_for_the_lock()
    {
        var end = Clock.GetUtcNow().AddSeconds(30);
        var id = await AuctionAsync(end: end);
        await using var locking = NewContext();
        await using var tx = await locking.Database.BeginTransactionAsync();
        await locking.Auctions.FromSqlInterpolated($"""SELECT *, xmin FROM "Auctions" WHERE "Id" = {id} FOR UPDATE""").SingleAsync();
        var bid = BidAsync(id, "bidder-a", 20);
        await Task.Delay(150); Assert.False(bid.IsCompleted);
        Clock.Set(end); await tx.CommitAsync();
        Assert.Equal(409, (await bid).StatusCode);
        await using var check = NewContext(); Assert.Empty(await check.Bids.ToListAsync());
        Assert.False((await check.Auctions.SingleAsync()).IsClosed);
    }
    [PostgresFact]
    public async Task Repeated_closure_sets_consistent_fields_and_notifications_once_after_commit()
    {
        var id = await AuctionAsync();
        await BidAsync(id, "bidder-a", 20);
        var visible = true;
        Recorder.Observer = async method =>
        {
            if (method != "AuctionClosed" && method != "NotificationCreated") return;
            await using var fresh = NewContext();
            visible &= (await fresh.Auctions.SingleAsync()).IsClosed && await fresh.Notifications.CountAsync() == 2;
        };
        var results = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => CloseAsync(id)));
        Assert.Single(results, r => r.Changed); Assert.True(visible);
        await using var db = NewContext(); var auction = await db.Auctions.SingleAsync();
        Assert.Equal(AuctionStatus.Closed, auction.Status); Assert.True(auction.IsClosed);
        Assert.NotNull(auction.ClosedAt); Assert.Equal("bidder-a", auction.WinnerId);
        Assert.Equal(auction.WinnerId, auction.WinnerUserId);
        Assert.Equal(2, await db.Notifications.CountAsync());
        Assert.Single(Recorder.Events, e => e == "AuctionClosed");
    }
    [PostgresFact]
    public async Task Reserve_not_met_has_no_winner_or_winner_notification()
    {
        var id = await AuctionAsync(reserve: 30); await BidAsync(id, "bidder-a", 20); await CloseAsync(id);
        await using var db = NewContext(); var auction = await db.Auctions.SingleAsync();
        Assert.Null(auction.WinnerId); Assert.Null(auction.WinnerUserId); Assert.Equal(20, auction.CurrentPrice);
        Assert.Single(await db.Notifications.ToListAsync());
        Assert.Equal("seller", (await db.Notifications.SingleAsync()).EventKind);
    }
    [PostgresFact]
    public async Task Closing_without_bids_has_no_winner_and_scheduled_closure_never_closes_early()
    {
        var id = await AuctionAsync();
        Assert.False((await CloseAsync(id, force: false)).Changed);
        Clock.Set(Clock.GetUtcNow().AddHours(2));
        Assert.True((await CloseAsync(id, force: false)).Changed);
        await using var db = NewContext(); var auction = await db.Auctions.SingleAsync();
        Assert.Null(auction.WinnerId); Assert.Equal(10, auction.CurrentPrice);
    }
    [PostgresFact]
    public async Task Failure_after_notification_sql_rolls_back_closure_and_all_notifications()
    {
        var id = await AuctionAsync(); await BidAsync(id, "bidder-a", 20);
        await using (var db = NewContext(new FailAfterSaveInterceptor(whenClosing: true)))
            await Assert.ThrowsAsync<InvalidOperationException>(() => new AuctionResolver(db, Events(), Clock).ResolveAsync(id, force: true));
        await using (var fresh = NewContext())
        {
            var auction = await fresh.Auctions.SingleAsync();
            Assert.False(auction.IsClosed); Assert.Null(auction.ClosedAt); Assert.Null(auction.WinnerId);
            Assert.Empty(await fresh.Notifications.ToListAsync());
        }
        Assert.DoesNotContain("AuctionClosed", Recorder.Events);
        await CloseAsync(id);
        await using var check = NewContext(); Assert.Equal(2, await check.Notifications.CountAsync());
    }
    [PostgresFact]
    public async Task Failure_after_bid_sql_rolls_back_price_count_and_bid()
    {
        var id = await AuctionAsync();
        await using (var db = NewContext(new FailAfterSaveInterceptor(whenClosing: false)))
            await Assert.ThrowsAsync<InvalidOperationException>(() => new BidService(db, Events(), Clock).PlaceAsync(id, "bidder-a", 20, Guid.NewGuid()));
        await using var fresh = NewContext(); var auction = await fresh.Auctions.SingleAsync();
        Assert.Equal(10, auction.CurrentPrice); Assert.Equal(0, auction.BidCount); Assert.Empty(await fresh.Bids.ToListAsync());
        Assert.Empty(Recorder.Events);
    }
    [PostgresFact]
    public async Task Xmin_detects_stale_updates_on_PostgreSQL()
    {
        var id = await AuctionAsync(); await using var a = NewContext(); await using var b = NewContext();
        var first = await a.Auctions.SingleAsync(x => x.Id == id); var second = await b.Auctions.SingleAsync(x => x.Id == id);
        first.Title = "First"; await a.SaveChangesAsync(); second.Title = "Stale";
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => b.SaveChangesAsync());
    }
    [PostgresFact]
    public async Task Self_premature_blocked_and_excess_precision_bids_are_rejected()
    {
        var id = await AuctionAsync(start: Clock.GetUtcNow().AddMinutes(1));
        Assert.Equal(409, (await BidAsync(id, "bidder-a", 20)).StatusCode);
        Assert.Equal(403, (await BidAsync(id, "seller", 20)).StatusCode);
        Assert.Equal(400, (await BidAsync(id, "bidder-a", 20.001m)).StatusCode);
        await using var db = NewContext();
        var user = await db.Users.SingleAsync(u => u.Id == "bidder-a"); user.IsBlocked = true; await db.SaveChangesAsync();
        Assert.Equal(403, (await BidAsync(id, "bidder-a", 20)).StatusCode);
    }
}

public class BlockingSaveInterceptor(bool whenClosing) : SaveChangesInterceptor
{
    public TaskCompletionSource Entered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData data, InterceptionResult<int> result, CancellationToken ct = default)
    {
        var matched = whenClosing ? data.Context!.ChangeTracker.Entries<Auction>().Any(e => e.Entity.IsClosed)
            : data.Context!.ChangeTracker.Entries<Bid>().Any(e => e.State == EntityState.Added);
        if (matched) { Entered.TrySetResult(); await Release.Task.WaitAsync(ct); }
        return result;
    }
}
public class FailAfterSaveInterceptor(bool whenClosing) : SaveChangesInterceptor
{
    public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData data, int result, CancellationToken ct = default)
    {
        throw new InvalidOperationException(whenClosing ? "Injected failure after notification SQL." : "Injected failure after bid SQL.");
    }
}
