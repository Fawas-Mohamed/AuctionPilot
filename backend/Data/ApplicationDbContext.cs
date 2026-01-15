using AuctionApi.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace AuctionApi.Data
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> opts) : base(opts) { }

        public DbSet<Auction> Auctions { get; set; }
        public DbSet<Bid> Bids { get; set; }
        public DbSet<Category> Categories { get; set; }
        public DbSet<Watchlist> Watchlists { get; set; }
        public DbSet<Order> Orders { get; set; }

        public DbSet<Notification> Notifications { get; set; }



        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);
            builder.Entity<Auction>()
                .Property(a => a.RowVersion).IsRowVersion();
            builder.Entity<Auction>()
                .Property(a => a.CurrentPrice).HasColumnType("decimal(18,2)");
            builder.Entity<Auction>()
                .Property(a => a.StartPrice).HasColumnType("decimal(18,2)");
            builder.Entity<Bid>()
                .Property(b => b.Amount).HasColumnType("decimal(18,2)");
        }
    }
}
