using System.ComponentModel.DataAnnotations;
namespace AuctionApi.Dtos;

public class CreateAuctionDto
{
    [Required, StringLength(200, MinimumLength = 1)] public string Title { get; set; } = "";
    [StringLength(10000)] public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public decimal StartPrice { get; set; }
    public decimal? ReservePrice { get; set; }
    [System.Text.Json.Serialization.JsonConverter(typeof(AuctionApi.Utils.StrictUtcDateTimeOffsetConverter))] public DateTimeOffset StartTime { get; set; }
    [System.Text.Json.Serialization.JsonConverter(typeof(AuctionApi.Utils.StrictUtcDateTimeOffsetConverter))] public DateTimeOffset EndTime { get; set; }
    public int? CategoryId { get; set; }
    public string? SellerId { get; set; }
}
