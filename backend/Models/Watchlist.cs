namespace AuctionApi.Models
{
    public class Watchlist
    {
        public int Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public int AuctionId { get; set; }

        // Navigation property
        public Auction Auction { get; set; }
    }
}