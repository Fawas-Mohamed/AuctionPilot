using AuctionApi.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace AuctionApi.Data;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<Auction> Auctions => Set<Auction>();
    public DbSet<Bid> Bids => Set<Bid>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Watchlist> Watchlists => Set<Watchlist>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<ImageAsset> ImageAssets => Set<ImageAsset>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.Entity<Auction>().Property(a => a.Version).IsRowVersion().HasColumnName("xmin");
        builder.Entity<Auction>().Property(a => a.StartPrice).HasPrecision(18, 2);
        builder.Entity<Auction>().Property(a => a.CurrentPrice).HasPrecision(18, 2);
        builder.Entity<Auction>().Property(a => a.ReservePrice).HasPrecision(18, 2);
        builder.Entity<Bid>().Property(a => a.Amount).HasPrecision(18, 2);
        builder.Entity<Order>().Property(a => a.Amount).HasPrecision(18, 2);
        builder.Entity<Auction>().HasOne(a => a.Seller).WithMany().HasForeignKey(a => a.SellerId).OnDelete(DeleteBehavior.Restrict);
        builder.Entity<Auction>().HasOne(a => a.Winner).WithMany().HasForeignKey(a => a.WinnerId).OnDelete(DeleteBehavior.Restrict);
        builder.Entity<Auction>().HasOne(a => a.ImageAsset).WithMany().HasForeignKey(a => a.ImageAssetId).OnDelete(DeleteBehavior.Restrict);
        builder.Entity<ApplicationUser>().HasOne<ImageAsset>().WithMany().HasForeignKey(u => u.AvatarAssetId).OnDelete(DeleteBehavior.Restrict);
        builder.Entity<Bid>().HasOne(b => b.Auction).WithMany(a => a.Bids).HasForeignKey(b => b.AuctionId).OnDelete(DeleteBehavior.Restrict);
        builder.Entity<Bid>().HasOne(b => b.Bidder).WithMany().HasForeignKey(b => b.BidderId).OnDelete(DeleteBehavior.Restrict);
        builder.Entity<Notification>().HasOne(n => n.User).WithMany().HasForeignKey(n => n.UserId).OnDelete(DeleteBehavior.Restrict);
        builder.Entity<Watchlist>().HasOne<ApplicationUser>().WithMany().HasForeignKey(w => w.UserId).OnDelete(DeleteBehavior.Restrict);
        builder.Entity<ImageAsset>().HasOne(i => i.Owner).WithMany().HasForeignKey(i => i.OwnerId).OnDelete(DeleteBehavior.Restrict);
        builder.Entity<ImageAsset>().HasIndex(i => i.AssetId).IsUnique();
        builder.Entity<ImageAsset>().HasIndex(i => i.PublicId).IsUnique();
        builder.Entity<Watchlist>().HasIndex(w => new { w.UserId, w.AuctionId }).IsUnique();
        builder.Entity<Bid>().HasIndex(b => new { b.AuctionId, b.BidderId, b.RequestId }).IsUnique();
        builder.Entity<Bid>().HasIndex(b => new { b.AuctionId, b.Amount, b.Time });
        builder.Entity<Auction>().HasIndex(a => a.EndTime).HasFilter("\"IsClosed\" = false");
        builder.Entity<Notification>().HasIndex(n => new { n.UserId, n.CreatedAt });
        builder.Entity<Notification>().HasIndex(n => new { n.AuctionId, n.UserId, n.EventKind })
            .IsUnique().HasFilter("\"EventKind\" IS NOT NULL");
        builder.Entity<Order>().HasOne(o => o.Auction).WithMany().HasForeignKey(o => o.AuctionId).OnDelete(DeleteBehavior.Restrict);
        builder.Entity<Order>().HasOne(o => o.Buyer).WithMany().HasForeignKey(o => o.BuyerId).OnDelete(DeleteBehavior.Restrict);
        builder.Entity<Auction>().ToTable(t =>
        {
            t.HasCheckConstraint("CK_Auction_Times", "\"EndTime\" > \"StartTime\"");
            t.HasCheckConstraint("CK_Auction_Money", "\"StartPrice\" >= 0 AND \"CurrentPrice\" >= \"StartPrice\" AND (\"ReservePrice\" IS NULL OR \"ReservePrice\" >= 0)");
            t.HasCheckConstraint("CK_Auction_Closure", "(\"IsClosed\" = false AND \"Status\" <> 3 AND \"ClosedAt\" IS NULL AND \"WinnerId\" IS NULL AND \"WinnerUserId\" IS NULL) OR (\"IsClosed\" = true AND \"Status\" = 3 AND \"ClosedAt\" IS NOT NULL AND \"WinnerId\" IS NOT DISTINCT FROM \"WinnerUserId\")");
        });
        builder.Entity<Bid>().ToTable(t => t.HasCheckConstraint("CK_Bid_Positive", "\"Amount\" > 0"));
        // PostgreSQL timestamptz accepts only offset zero. Explicitly normalize all DateTimeOffsets,
        // including Identity's LockoutEnd. Reject ambiguous DateTime writes.
        var offsetConverter = new ValueConverter<DateTimeOffset, DateTimeOffset>(v => v.ToUniversalTime(), v => v.ToUniversalTime());
        foreach (var entity in builder.Model.GetEntityTypes())
            foreach (var property in entity.GetProperties())
                if (property.ClrType == typeof(DateTimeOffset) || property.ClrType == typeof(DateTimeOffset?))
                {
                    property.SetValueConverter(offsetConverter);
                    property.SetColumnType("timestamp with time zone");
                }
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries().Where(e => e.State is EntityState.Added or EntityState.Modified))
            foreach (var property in entry.Properties)
                if (property.CurrentValue is DateTime value && value.Kind != DateTimeKind.Utc)
                    throw new InvalidOperationException("All persisted DateTime values must specify UTC.");
        return base.SaveChangesAsync(cancellationToken);
    }
}
