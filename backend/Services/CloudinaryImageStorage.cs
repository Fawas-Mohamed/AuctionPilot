using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using AuctionApi.Utils;
namespace AuctionApi.Services;

public record StoredImage(string AssetId, string PublicId, string SecureUrl, long Bytes);
public interface IImageStorage
{
    Task<StoredImage> UploadAsync(ValidatedImage image, CancellationToken ct);
}
public class ImageStorageException(string message) : Exception(message);

public class CloudinaryImageStorage(HttpClient client, IConfiguration config) : IImageStorage
{
    public async Task<StoredImage> UploadAsync(ValidatedImage image, CancellationToken ct)
    {
        var cloud = config["Cloudinary:CloudName"];
        var apiKey = config["Cloudinary:ApiKey"];
        var secret = config["Cloudinary:ApiSecret"];
        if (string.IsNullOrWhiteSpace(cloud) || !Regex.IsMatch(cloud, @"^[a-zA-Z0-9_-]+$") ||
            string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(secret))
            throw new ImageStorageException("Image storage is not configured.");
        var publicId = $"auctionpilot-demo/{Guid.NewGuid():N}";
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture);
        var signed = $"overwrite=false&public_id={publicId}&timestamp={timestamp}{secret}";
        var signature = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(signed))).ToLowerInvariant();
        using var body = new MultipartFormDataContent();
        var file = new ByteArrayContent(image.Bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(image.ContentType);
        body.Add(file, "file", $"{Guid.NewGuid():N}{image.Extension}");
        body.Add(new StringContent(apiKey), "api_key");
        body.Add(new StringContent(timestamp), "timestamp");
        body.Add(new StringContent(publicId), "public_id");
        body.Add(new StringContent("false"), "overwrite");
        body.Add(new StringContent(signature), "signature");
        try
        {
            using var response = await client.PostAsync($"https://api.cloudinary.com/v1_1/{cloud}/image/upload", body, ct);
            if (!response.IsSuccessStatusCode) throw new ImageStorageException("Image storage rejected the upload.");
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
            var root = document.RootElement;
            var url = root.GetProperty("secure_url").GetString()!;
            var asset = root.GetProperty("asset_id").GetString()!;
            var returnedPublicId = root.GetProperty("public_id").GetString();
            if (string.IsNullOrWhiteSpace(asset) || returnedPublicId != publicId ||
                !Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != "https" ||
                uri.Host != "res.cloudinary.com" || !uri.AbsolutePath.StartsWith($"/{cloud}/image/upload/", StringComparison.Ordinal))
                throw new ImageStorageException("Image storage returned an invalid asset.");
            return new(asset, publicId, url, root.GetProperty("bytes").GetInt64());
        }
        catch (HttpRequestException) { throw new ImageStorageException("Image storage is temporarily unavailable."); }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested) { throw new ImageStorageException("Image storage timed out."); }
        catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException)
        { throw new ImageStorageException("Image storage returned an invalid response."); }
    }
}
