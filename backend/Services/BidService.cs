using AuctionApi.Data;
using AuctionApi.Models;
using Microsoft.EntityFrameworkCore;
namespace AuctionApi.Services;

public record BidResult(int StatusCode, string Message, decimal? CurrentPrice = null, int? BidCount = null, int? BidId = null, DateTime? Time = null);

public class BidService(ApplicationDbContext db, AuctionEvents events, TimeProvider clock)
{
    public static bool IsMoney(decimal value) => value >= 0 && value <= 9999999999999999.99m && decimal.Round(value, 2) == value;

    public async Task<BidResult> PlaceAsync(int auctionId, string userId, decimal amount, Guid requestId, CancellationToken ct = default)
    {
        if (requestId == Guid.Empty) return new(400, "A non-empty requestId is required.");
        if (!IsMoney(amount) || amount <= 0) return new(400, "Use a positive amount with at most two decimal places.");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        // All writes affecting bids/closure take this same PostgreSQL lock, then reread the row.
        var auction = await db.Auctions.FromSqlInterpolated(
            $"""SELECT *, xmin FROM "Auctions" WHERE "Id" = {auctionId} FOR UPDATE""").SingleOrDefaultAsync(ct);
        if (auction == null) return new(404, "Auction not found.");
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == userId, ct);
        var now = clock.GetUtcNow();
        if (user == null || user.IsBlocked || (user.LockoutEnd != null && user.LockoutEnd > now))
            return new(403, "Account cannot bid.");
        var prior = await db.Bids.AsNoTracking().SingleOrDefaultAsync(
            b => b.AuctionId == auctionId && b.BidderId == userId && b.RequestId == requestId, ct);
        if (prior != null)
            return prior.Amount == amount
                ? new(200, "Bid already accepted.", auction.CurrentPrice, auction.BidCount, prior.Id, prior.Time)
                : new(409, "requestId was already used with another amount.");
        if (auction.SellerId == userId || auction.CreatedById == userId) return new(403, "You cannot bid on your own auction.");
        if (auction.IsClosed || auction.Status == AuctionStatus.Closed || now >= auction.EndTime)
            return new(409, "Auction has ended.");
        if (auction.Status == AuctionStatus.Draft || now < auction.StartTime) return new(409, "Auction has not started.");
        if (amount <= auction.CurrentPrice) return new(409, "Bid must exceed the current price.", auction.CurrentPrice, auction.BidCount);
        var bid = new Bid { AuctionId = auctionId, BidderId = userId, Amount = amount,
            RequestId = requestId, Time = now.UtcDateTime, CreatedAt = now.UtcDateTime };
        db.Bids.Add(bid);
        auction.CurrentPrice = amount;
        auction.BidCount++;
        auction.Status = AuctionStatus.Live;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        await events.BidAsync(auction, bid);
        return new(200, "Bid accepted.", auction.CurrentPrice, auction.BidCount, bid.Id, bid.Time);
    }
}
