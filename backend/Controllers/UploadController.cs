using AuctionApi.Dtos;
using AuctionApi.Services;
using AuctionApi.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;
namespace AuctionApi.Controllers;

[ApiController, Route("api/uploads"), Authorize, EnableRateLimiting("uploads")]
public class UploadsController(ImageAssetService images) : ControllerBase
{
    [HttpPost, Consumes("multipart/form-data")]
    [RequestSizeLimit(ImageUploadValidation.MaxBytes + 65536)]
    [RequestFormLimits(MultipartBodyLengthLimit = ImageUploadValidation.MaxBytes + 65536)]
    public async Task<IActionResult> UploadImage([FromForm] ImageUploadDto model, CancellationToken ct)
    {
        try
        {
            var asset = await images.UploadAsync(model.File, User.FindFirstValue(ClaimTypes.NameIdentifier)!, ct);
            return Ok(new { imageUrl = asset.SecureUrl, assetId = asset.Id });
        }
        catch (InvalidImageException ex) { return BadRequest(new { message = ex.Message }); }
        catch (ImageStorageException ex) { return StatusCode(502, new { message = ex.Message }); }
    }
}
