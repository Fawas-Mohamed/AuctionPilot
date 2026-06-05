using System.ComponentModel.DataAnnotations;

namespace AuctionApi.Models
{
    public enum AuctionStatus { Draft = 0, Scheduled = 1, Live = 2, Closed = 3 }

    public class Auction
    {
        public int Id { get; set; }

        [Required]
        public string Title { get; set; } = "";

        public string? Description { get; set; }
        public string? ImageUrl { get; set; }

        public decimal StartPrice { get; set; }
        public decimal CurrentPrice { get; set; }

        public DateTimeOffset StartTime { get; set; }
        public DateTimeOffset EndTime { get; set; }


        public string? SellerId { get; set; }

        public bool IsClosed { get; set; } = false;   
        public string? WinnerUserId { get; set; }     
        public decimal? ReservePrice { get; set; }
        public string? CreatedById { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;


        public AuctionStatus Status { get; set; } = AuctionStatus.Scheduled;

        public int BidCount { get; set; }

        public string? WinnerId { get; set; }
        public ApplicationUser? Winner { get; set; }

        public virtual ICollection<Bid>? Bids { get; set; }
        public int? CategoryId { get; set; }
        public Category? Category { get; set; }     
        public ApplicationUser Seller { get; set; }

        [Timestamp]
        public byte[]? RowVersion { get; set; }
    }
    
}
