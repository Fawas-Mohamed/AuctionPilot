using System.Linq.Expressions;
using AuctionApi.Models;
namespace AuctionApi.Dtos;

public class AuctionResponse
{
    public int Id { get; init; }
    public string Title { get; init; } = "";
    public string? Description { get; init; }
    public string? ImageUrl { get; init; }
    public decimal StartPrice { get; init; }
    public decimal CurrentPrice { get; init; }
    public DateTimeOffset StartTime { get; init; }
    public DateTimeOffset EndTime { get; init; }
    public DateTimeOffset? ClosedAt { get; init; }
    public bool IsClosed { get; init; }
    public AuctionStatus Status { get; init; }
    public int BidCount { get; init; }
    public string? CreatedById { get; init; }
    public string? SellerId { get; init; }
    public DateTime CreatedAt { get; init; }
    public int? CategoryId { get; init; }
    public CategoryResponse? Category { get; init; }
    public SellerResponse? Seller { get; init; }
    public bool HasWinner { get; init; }

    public static Expression<Func<Auction, AuctionResponse>> Select(DateTimeOffset now) => a => new AuctionResponse
    {
        Id = a.Id, Title = a.Title, Description = a.Description, ImageUrl = a.ImageUrl,
        StartPrice = a.StartPrice, CurrentPrice = a.CurrentPrice,
        StartTime = a.StartTime, EndTime = a.EndTime, ClosedAt = a.ClosedAt,
        IsClosed = a.IsClosed, Status = a.IsClosed ? AuctionStatus.Closed :
            a.Status == AuctionStatus.Draft ? AuctionStatus.Draft :
            a.StartTime <= now ? AuctionStatus.Live : AuctionStatus.Scheduled,
        BidCount = a.BidCount, CreatedById = a.CreatedById, SellerId = a.SellerId,
        CreatedAt = a.CreatedAt, CategoryId = a.CategoryId,
        Category = a.Category == null ? null : new CategoryResponse(a.Category.Id, a.Category.Name),
        Seller = a.Seller == null ? null : new SellerResponse(a.Seller.DisplayName, a.Seller.AvatarUrl),
        HasWinner = a.IsClosed && a.WinnerId != null
    };
}
public record CategoryResponse(int Id, string Name);
public record SellerResponse(string? DisplayName, string? AvatarUrl);
