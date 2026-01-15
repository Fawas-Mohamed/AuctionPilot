using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AuctionApi.Models
{
    public class Bid
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int AuctionId { get; set; }

        [ForeignKey(nameof(AuctionId))]
        public Auction Auction { get; set; } = null!;

        [Required]
        public string BidderId { get; set; } = null!;  // ✅ Must be required for valid relationship

        [ForeignKey(nameof(BidderId))]
        public ApplicationUser Bidder { get; set; } = null!;

        [Column(TypeName = "decimal(18,2)")]
        public decimal Amount { get; set; }

        public DateTime Time { get; set; } = DateTime.UtcNow;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
