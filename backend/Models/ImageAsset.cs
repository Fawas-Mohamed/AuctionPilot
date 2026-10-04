namespace AuctionApi.Models;

// Assets are retained for manual cleanup, including replaced/unattached uploads.
public class ImageAsset
{
    public int Id { get; set; }
    public string OwnerId { get; set; } = "";
    public ApplicationUser? Owner { get; set; }
    public string AssetId { get; set; } = "";
    public string PublicId { get; set; } = "";
    public string SecureUrl { get; set; } = "";
    public string ResourceType { get; set; } = "image";
    public string DeliveryType { get; set; } = "upload";
    public long Bytes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
