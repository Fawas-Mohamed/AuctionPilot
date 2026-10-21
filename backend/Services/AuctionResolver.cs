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

        var notifications = await CloseLockedAsync(auction, now, ct);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        await events.ClosedAsync(auction, notifications);
        return new(true, true);
    }

    // Caller must hold the auction row lock and commit before publishing events.
    internal async Task<IReadOnlyList<Notification>> CloseLockedAsync(Auction auction, DateTimeOffset now, CancellationToken ct)
    {
        var auctionId = auction.Id;
        var topBid = await db.Bids.Where(b => b.AuctionId == auctionId)
            .OrderByDescending(b => b.Amount).ThenBy(b => b.Time).ThenBy(b => b.Id).FirstOrDefaultAsync(ct);
        var reserveMet = topBid != null && topBid.Amount >= auction.StartPrice
            && (auction.ReservePrice == null || topBid.Amount >= auction.ReservePrice);
        auction.WinnerId = reserveMet ? topBid!.BidderId : null;
        auction.WinnerUserId = auction.WinnerId;
        auction.CurrentPrice = Math.Max(topBid?.Amount ?? auction.StartPrice, auction.StartPrice);
        auction.BidCount = await db.Bids.CountAsync(b => b.AuctionId == auctionId, ct);
        auction.IsClosed = true;
        auction.Status = AuctionStatus.Closed;
        auction.ClosedAt ??= now;

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
                    : topBid == null ? $"'{auction.Title}' closed with no bids." : $"'{auction.Title}' closed without meeting its minimum price.",
                CreatedAt = now.UtcDateTime });
        // Recalculate existing closure notices when an administrator edits a closed lot.
        // Reuse matching rows so repeated edits cannot duplicate winner/seller notifications.
        var existing = await db.Notifications.Where(n => n.AuctionId == auctionId
            && (n.EventKind == "winner" || n.EventKind == "seller")).ToListAsync(ct);
        var changed = new List<Notification>();
        foreach (var notification in notifications)
        {
            var prior = existing.SingleOrDefault(n => n.UserId == notification.UserId && n.EventKind == notification.EventKind);
            if (prior == null) { db.Notifications.Add(notification); changed.Add(notification); }
            else
            {
                existing.Remove(prior);
                if (prior.Title == notification.Title && prior.Message == notification.Message && prior.BidId == notification.BidId) continue;
                prior.Title = notification.Title;
                prior.Message = notification.Message;
                prior.BidId = notification.BidId;
                prior.IsRead = false;
                changed.Add(prior);
            }
        }
        db.Notifications.RemoveRange(existing);
        return changed;
    }
}
