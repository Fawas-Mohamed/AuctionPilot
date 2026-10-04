using AuctionApi.Data;
using AuctionApi.Models;
using Microsoft.EntityFrameworkCore;
namespace AuctionApi.Services;

public record ClosureResult(bool Found, bool Changed);

public class AuctionResolver(ApplicationDbContext db, AuctionEvents events, TimeProvider clock)
{
    public async Task<ClosureResult> ResolveAsync(int auctionId, bool force = false, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var auction = await db.Auctions.FromSqlInterpolated(
            $"""SELECT *, xmin FROM "Auctions" WHERE "Id" = {auctionId} FOR UPDATE""").SingleOrDefaultAsync(ct);
        if (auction == null) return new(false, false);
        if (auction.IsClosed) return new(true, false);
        var now = clock.GetUtcNow();
        if (!force && now < auction.EndTime) return new(true, false);

        var topBid = await db.Bids.Where(b => b.AuctionId == auctionId)
            .OrderByDescending(b => b.Amount).ThenBy(b => b.Time).ThenBy(b => b.Id).FirstOrDefaultAsync(ct);
        var reserveMet = topBid != null && (auction.ReservePrice == null || topBid.Amount >= auction.ReservePrice);
        auction.WinnerId = reserveMet ? topBid!.BidderId : null;
        auction.WinnerUserId = auction.WinnerId;
        auction.CurrentPrice = topBid?.Amount ?? auction.StartPrice;
        auction.BidCount = await db.Bids.CountAsync(b => b.AuctionId == auctionId, ct);
        auction.IsClosed = true;
        auction.Status = AuctionStatus.Closed;
        auction.ClosedAt = now;

        var notifications = new List<Notification>();
        if (reserveMet)
            notifications.Add(new Notification { UserId = topBid!.BidderId, AuctionId = auction.Id, BidId = topBid.Id,
                EventKind = "winner", Title = "You won a demo auction",
                Message = $"Your bid of LKR {topBid.Amount:F2} won '{auction.Title}'. Demo only: no payment, shipping or settlement.",
                CreatedAt = now.UtcDateTime });
        if (!string.IsNullOrEmpty(auction.SellerId))
            notifications.Add(new Notification { UserId = auction.SellerId, AuctionId = auction.Id, EventKind = "seller",
                Title = "Your demo auction closed",
                Message = reserveMet ? $"'{auction.Title}' closed at LKR {topBid!.Amount:F2}. Demo only: no money is collected."
                    : topBid == null ? $"'{auction.Title}' closed with no bids." : $"'{auction.Title}' closed without meeting its reserve.",
                CreatedAt = now.UtcDateTime });
        // A notification failure fails the entire transaction. A retry cannot duplicate committed events.
        db.Notifications.AddRange(notifications);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        await events.ClosedAsync(auction, notifications);
        return new(true, true);
    }
}
