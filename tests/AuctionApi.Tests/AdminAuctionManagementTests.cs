using System.Security.Claims;
using AuctionApi.Controllers;
using AuctionApi.Data;
using AuctionApi.Dtos;
using AuctionApi.Models;
using AuctionApi.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace AuctionApi.Tests;

public class AdminAuctionManagementTests : PostgresDatabase
{
    // PostgreSQL stores timestamps to microsecond precision.
    public AdminAuctionManagementTests() => Clock.Set(new DateTimeOffset(Clock.GetUtcNow().UtcTicks / 10 * 10, TimeSpan.Zero));
    private readonly ServiceProvider services = new ServiceCollection().BuildServiceProvider();
    private AdminAuctionsController Controller(ApplicationDbContext db)
    {
        var events = Events();
        return new(db, new AuctionResolver(db, events, Clock), events, new BidService(db, events, Clock),
            new AuctionReconciler(services.GetRequiredService<IServiceScopeFactory>(), Clock), new AuctionSchedule(), Clock)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, "seller"), new Claim(ClaimTypes.Role, "Admin") }, "test"))
            } }
        };
    }
    private async Task<AdminUpdateAuctionDto> EditAsync(int id)
    {
        await using var db = NewContext();
        var a = await db.Auctions.SingleAsync(a => a.Id == id);
        return new() { Title = a.Title, Description = a.Description, StartPrice = a.StartPrice,
            ReservePrice = a.ReservePrice, StartTime = a.StartTime, EndTime = a.EndTime,
            ImageUrl = a.ImageUrl, CategoryId = a.CategoryId };
    }
    private async Task<IActionResult> UpdateAsync(int id, AdminUpdateAuctionDto dto)
    {
        await using var db = NewContext();
        return await Controller(db).Update(id, dto, default);
    }
    [PostgresFact]
    public async Task Active_auction_with_bids_can_be_edited_extended_and_shortened_without_resetting_bids()
    {
        var id = await AuctionAsync(reserve: 25);
        await BidAsync(id, "bidder-a", 20); await BidAsync(id, "bidder-b", 30);
        var dto = await EditAsync(id); dto.Title = "Admin edit"; dto.StartPrice = 15;
        dto.EndTime = Clock.GetUtcNow().AddHours(3);
        Assert.IsType<OkObjectResult>(await UpdateAsync(id, dto));
        dto.EndTime = Clock.GetUtcNow().AddMinutes(15);
        Assert.IsType<OkObjectResult>(await UpdateAsync(id, dto));
        await using var db = NewContext(); var a = await db.Auctions.SingleAsync();
        Assert.Equal("Admin edit", a.Title); Assert.Equal(dto.EndTime, a.EndTime);
        Assert.Equal(30m, a.CurrentPrice); Assert.Equal(25m, a.ReservePrice); Assert.Equal(2, a.BidCount);
        Assert.Equal(2, await db.Bids.CountAsync()); Assert.False(a.IsClosed); Assert.Null(a.WinnerId);
        Assert.Equal(200, (await BidAsync(id, "bidder-a", 31)).StatusCode);
        Assert.Contains("AuctionUpdated", Recorder.Events);
    }
    [PostgresFact]
    public async Task Shortening_to_the_past_closes_atomically_and_repeated_edits_do_not_duplicate_notifications()
    {
        var id = await AuctionAsync(start: Clock.GetUtcNow().AddHours(-2)); await BidAsync(id, "bidder-a", 20);
        var dto = await EditAsync(id); dto.EndTime = Clock.GetUtcNow().AddMinutes(-1);
        Assert.IsType<OkObjectResult>(await UpdateAsync(id, dto));
        DateTimeOffset? closedAt; int[] notificationIds;
        await using (var db = NewContext())
        {
            var a = await db.Auctions.SingleAsync(); Assert.True(a.IsClosed); Assert.Equal(AuctionStatus.Closed, a.Status);
            Assert.Equal("bidder-a", a.WinnerId); Assert.Equal(a.WinnerId, a.WinnerUserId); closedAt = a.ClosedAt;
            notificationIds = await db.Notifications.OrderBy(n => n.Id).Select(n => n.Id).ToArrayAsync(); Assert.Equal(2, notificationIds.Length);
        }
        dto.Title = "Closed lot corrected";
        Assert.IsType<OkObjectResult>(await UpdateAsync(id, dto));
        Assert.IsType<OkObjectResult>(await UpdateAsync(id, dto));
        await using var check = NewContext(); Assert.Equal(closedAt, (await check.Auctions.SingleAsync()).ClosedAt);
        Assert.Equal(notificationIds, await check.Notifications.OrderBy(n => n.Id).Select(n => n.Id).ToArrayAsync());
        Assert.All(await check.Notifications.ToListAsync(), n => Assert.Contains(dto.Title, n.Message));
        Assert.Equal(409, (await BidAsync(id, "bidder-b", 30)).StatusCode);
    }
    [PostgresFact]
    public async Task Closed_auction_can_be_reopened_and_closed_again_with_consistent_result_and_notifications()
    {
        var id = await AuctionAsync(); await BidAsync(id, "bidder-a", 20); await CloseAsync(id);
        await using (var setup = NewContext())
        { setup.Orders.Add(new Order { AuctionId = id, BuyerId = "bidder-a", Amount = 20 }); await setup.SaveChangesAsync(); }
        var dto = await EditAsync(id); dto.Reopen = true; dto.EndTime = Clock.GetUtcNow().AddHours(2);
        Assert.IsType<OkObjectResult>(await UpdateAsync(id, dto));
        await using (var db = NewContext())
        {
            var a = await db.Auctions.SingleAsync(); Assert.False(a.IsClosed); Assert.Null(a.ClosedAt);
            Assert.Null(a.WinnerId); Assert.Null(a.WinnerUserId); Assert.Equal(AuctionStatus.Live, a.Status);
            Assert.Equal(20m, a.CurrentPrice); Assert.Equal(1, a.BidCount); Assert.Single(await db.Bids.ToListAsync());
            Assert.Empty(await db.Notifications.ToListAsync()); Assert.Equal("Cancelled", (await db.Orders.SingleAsync()).Status);
        }
        Assert.Equal(200, (await BidAsync(id, "bidder-b", 30)).StatusCode);
        Assert.True((await CloseAsync(id)).Changed); Assert.False((await CloseAsync(id)).Changed);
        await using var check = NewContext(); Assert.Equal("bidder-b", (await check.Auctions.SingleAsync()).WinnerId);
        Assert.Equal(2, await check.Notifications.CountAsync());
    }
    [PostgresFact]
    public async Task Closed_auction_stays_closed_without_explicit_reopen_and_admin_can_change_minimum_prices()
    {
        var id = await AuctionAsync(reserve: 30); await BidAsync(id, "bidder-a", 20); await CloseAsync(id);
        var dto = await EditAsync(id); dto.StartPrice = 50; dto.ReservePrice = null;
        Assert.IsType<OkObjectResult>(await UpdateAsync(id, dto));
        await using (var db = NewContext())
        {
            var a = await db.Auctions.SingleAsync(); Assert.True(a.IsClosed); Assert.Equal(50m, a.CurrentPrice);
            Assert.Null(a.WinnerId); Assert.Single(await db.Notifications.ToListAsync()); Assert.Equal(20m, (await db.Bids.SingleAsync()).Amount);
        }
        dto.StartPrice = 10; Assert.IsType<OkObjectResult>(await UpdateAsync(id, dto));
        await using var check = NewContext(); Assert.Equal("bidder-a", (await check.Auctions.SingleAsync()).WinnerId);
        Assert.Equal(2, await check.Notifications.CountAsync());
    }
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Admin_can_delete_live_or_closed_auctions_with_all_dependents_and_preserve_other_auctions(bool closed)
    {
        var id = await AuctionAsync(); var other = await AuctionAsync();
        await BidAsync(id, "bidder-a", 20); await BidAsync(other, "bidder-b", 30);
        if (closed) await CloseAsync(id);
        await using (var setup = NewContext())
        {
            var bid = await setup.Bids.SingleAsync(b => b.AuctionId == id);
            setup.Notifications.Add(new Notification { UserId = "bidder-a", BidId = bid.Id, Title = "Legacy bid-only notice" });
            setup.Watchlists.AddRange(new Watchlist { AuctionId = id, UserId = "bidder-a" }, new Watchlist { AuctionId = other, UserId = "bidder-b" });
            setup.Orders.AddRange(new Order { AuctionId = id, BuyerId = "bidder-a", Amount = 20 }, new Order { AuctionId = other, BuyerId = "bidder-b", Amount = 30 });
            await setup.SaveChangesAsync();
        }
        await using (var db = NewContext()) Assert.IsType<NoContentResult>(await Controller(db).Delete(id, default));
        await using var check = NewContext(); Assert.Equal(other, (await check.Auctions.SingleAsync()).Id);
        Assert.Equal(other, (await check.Bids.SingleAsync()).AuctionId); Assert.Equal(other, (await check.Orders.SingleAsync()).AuctionId);
        Assert.Equal(other, (await check.Watchlists.SingleAsync()).AuctionId); Assert.Empty(await check.Notifications.ToListAsync());
        Assert.Equal(404, (await BidAsync(id, "bidder-a", 40)).StatusCode); Assert.Contains("AuctionDeleted", Recorder.Events);
    }
    [PostgresFact]
    public async Task Delete_failure_rolls_back_auction_bids_and_notifications_and_publishes_no_delete_event()
    {
        var id = await AuctionAsync(); await BidAsync(id, "bidder-a", 20); await CloseAsync(id);
        await using (var db = NewContext(new FailAfterSaveInterceptor(true)))
            await Assert.ThrowsAsync<InvalidOperationException>(() => Controller(db).Delete(id, default));
        await using var check = NewContext(); Assert.Single(await check.Auctions.ToListAsync());
        Assert.Single(await check.Bids.ToListAsync()); Assert.Equal(2, await check.Notifications.CountAsync());
        Assert.DoesNotContain("AuctionDeleted", Recorder.Events);
    }
    [PostgresFact]
    public async Task Failed_reopen_restores_closed_result_and_notifications()
    {
        var id = await AuctionAsync(); await BidAsync(id, "bidder-a", 20); await CloseAsync(id);
        var dto = await EditAsync(id); dto.Reopen = true;
        await using (var db = NewContext(new FailAfterSaveInterceptor(true)))
            await Assert.ThrowsAsync<InvalidOperationException>(() => Controller(db).Update(id, dto, default));
        await using var check = NewContext(); var a = await check.Auctions.SingleAsync();
        Assert.True(a.IsClosed); Assert.Equal("bidder-a", a.WinnerId); Assert.NotNull(a.ClosedAt);
        Assert.Equal(2, await check.Notifications.CountAsync()); Assert.DoesNotContain("AuctionUpdated", Recorder.Events);
    }
    [PostgresFact]
    public async Task Edit_waits_for_concurrent_bid_and_preserves_the_committed_highest_bid()
    {
        var id = await AuctionAsync(); var dto = await EditAsync(id); dto.EndTime = Clock.GetUtcNow().AddHours(2);
        var blocker = new BlockingSaveInterceptor(false);
        await using var bidDb = NewContext(blocker);
        var bid = new BidService(bidDb, Events(), Clock).PlaceAsync(id, "bidder-a", 20, Guid.NewGuid());
        await blocker.Entered.Task.WaitAsync(TimeSpan.FromSeconds(10));
        var edit = UpdateAsync(id, dto);
        await Task.Delay(100); Assert.False(edit.IsCompleted); blocker.Release.TrySetResult();
        Assert.Equal(200, (await bid).StatusCode); Assert.IsType<OkObjectResult>(await edit);
        await using var check = NewContext(); var a = await check.Auctions.SingleAsync(); Assert.Equal(20m, a.CurrentPrice); Assert.Equal(1, a.BidCount);
    }
    [PostgresFact]
    public async Task Delete_waits_for_concurrent_bid_then_removes_its_history()
    {
        var id = await AuctionAsync(); var blocker = new BlockingSaveInterceptor(false);
        await using var bidDb = NewContext(blocker); await using var deleteDb = NewContext();
        var bid = new BidService(bidDb, Events(), Clock).PlaceAsync(id, "bidder-a", 20, Guid.NewGuid());
        await blocker.Entered.Task.WaitAsync(TimeSpan.FromSeconds(10));
        var delete = Controller(deleteDb).Delete(id, default);
        await Task.Delay(100); Assert.False(delete.IsCompleted); blocker.Release.TrySetResult();
        Assert.Equal(200, (await bid).StatusCode); Assert.IsType<NoContentResult>(await delete);
        await using var check = NewContext(); Assert.Empty(await check.Bids.ToListAsync()); Assert.Empty(await check.Auctions.ToListAsync());
    }
    [PostgresFact]
    public async Task Invalid_schedule_money_and_reopening_to_the_past_leave_state_unchanged()
    {
        var id = await AuctionAsync(); await CloseAsync(id);
        var dto = await EditAsync(id); dto.EndTime = dto.StartTime;
        Assert.IsType<BadRequestObjectResult>(await UpdateAsync(id, dto));
        dto = await EditAsync(id); dto.Reopen = true; dto.EndTime = Clock.GetUtcNow().AddSeconds(-1);
        Assert.IsType<BadRequestObjectResult>(await UpdateAsync(id, dto));
        dto = await EditAsync(id); dto.StartPrice = 1.001m;
        Assert.IsType<BadRequestObjectResult>(await UpdateAsync(id, dto));
        await using var check = NewContext(); var a = await check.Auctions.SingleAsync();
        Assert.True(a.IsClosed); Assert.Equal(10m, a.StartPrice); Assert.Equal(Clock.GetUtcNow().AddHours(1), a.EndTime);
    }
    public override async Task DisposeAsync() { await services.DisposeAsync(); await base.DisposeAsync(); }
}
