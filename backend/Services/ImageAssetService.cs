using AuctionApi.Data;
using AuctionApi.Models;
using AuctionApi.Utils;
using Microsoft.EntityFrameworkCore;
namespace AuctionApi.Services;

public class ImageAssetService(ApplicationDbContext db, IImageStorage storage, ILogger<ImageAssetService> logger)
{
    public async Task<ImageAsset> UploadAsync(IFormFile? file, string userId, CancellationToken ct)
    {
        var image = await ImageUploadValidation.ValidateAsync(file, ct);
        var stored = await storage.UploadAsync(image, ct);
        var asset = new ImageAsset { OwnerId = userId, AssetId = stored.AssetId, PublicId = stored.PublicId,
            SecureUrl = stored.SecureUrl, Bytes = stored.Bytes };
        db.ImageAssets.Add(asset);
        try { await db.SaveChangesAsync(ct); }
        catch (Exception ex) when (ex is DbUpdateException or OperationCanceledException)
        {
            logger.LogError("Uploaded asset {PublicId} could not be recorded; review it manually. Existing assets are retained.", stored.PublicId);
            throw new ImageStorageException("The upload could not be saved. Please retry.");
        }
        return asset;
    }
}
