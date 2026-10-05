using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace AuctionApi.Models;

public enum AuctionStatus { Draft = 0, Scheduled = 1, Live = 2, Closed = 3 }

public class Auction
{
    public int Id { get; set; }
    [Required, MaxLength(200)] public string Title { get; set; } = "";
    [MaxLength(10000)] public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public int? ImageAssetId { get; set; }
    [JsonIgnore] public ImageAsset? ImageAsset { get; set; }
    public decimal StartPrice { get; set; }
    public decimal CurrentPrice { get; set; }
    public decimal? ReservePrice { get; set; }
    public DateTimeOffset StartTime { get; set; }
    public DateTimeOffset EndTime { get; set; }
    public DateTimeOffset? ClosedAt { get; set; }
    public string? SellerId { get; set; }
    public string? CreatedById { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsClosed { get; set; }
    public AuctionStatus Status { get; set; } = AuctionStatus.Scheduled;
    public int BidCount { get; set; }
    public string? WinnerId { get; set; }
    // Keep both legacy winner columns consistent; neither is set until closure.
    public string? WinnerUserId { get; set; }
    [JsonIgnore] public ApplicationUser? Winner { get; set; }
    [JsonIgnore] public ApplicationUser? Seller { get; set; }
    [JsonIgnore] public ICollection<Bid> Bids { get; set; } = new List<Bid>();
    public int? CategoryId { get; set; }
    public Category? Category { get; set; }
    [Timestamp, JsonIgnore] public uint Version { get; set; }
}
