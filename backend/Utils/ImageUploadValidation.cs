using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Formats.Webp;

namespace AuctionApi.Utils;

public record ValidatedImage(byte[] Bytes, string Extension, string ContentType);
public class InvalidImageException(string message) : Exception(message);

public static class ImageUploadValidation
{
    public const int MaxBytes = 5 * 1024 * 1024;
    private const long MaxPixels = 20_000_000;

    private static readonly SemaphoreSlim DecodeSlots = new(2);

    public static async Task<ValidatedImage> ValidateAsync(IFormFile? file, CancellationToken ct = default)
    {
        await DecodeSlots.WaitAsync(ct);
        try { return await ValidateCoreAsync(file, ct); }
        finally { DecodeSlots.Release(); }
    }

    private static async Task<ValidatedImage> ValidateCoreAsync(IFormFile? file, CancellationToken ct = default)
    {
        if (file == null || file.Length <= 0 || file.Length > MaxBytes)
            throw new InvalidImageException("Select an image no larger than 5 MiB.");
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (extension == ".jpeg") extension = ".jpg";
        var contentType = extension switch { ".jpg" => "image/jpeg", ".png" => "image/png", ".webp" => "image/webp", _ => "" };
        if (contentType.Length == 0 || !string.Equals(file.ContentType, contentType, StringComparison.OrdinalIgnoreCase))
            throw new InvalidImageException("Only JPEG, PNG and WebP files with matching content types are accepted.");
        await using var input = file.OpenReadStream();
        using var source = new MemoryStream();
        var buffer = new byte[81920];
        int read;
        while ((read = await input.ReadAsync(buffer, ct)) > 0)
        {
            if (source.Length + read > MaxBytes) throw new InvalidImageException("Image exceeds 5 MiB.");
            await source.WriteAsync(buffer.AsMemory(0, read), ct);
        }
        var data = source.ToArray();
        var matches = extension switch
        {
            ".jpg" => data.Length >= 3 && data[0] == 255 && data[1] == 216 && data[2] == 255,
            ".png" => data.AsSpan().StartsWith(new byte[] {137,80,78,71,13,10,26,10}),
            ".webp" => data.Length >= 12 && data.AsSpan(0,4).SequenceEqual("RIFF"u8) && data.AsSpan(8,4).SequenceEqual("WEBP"u8),
            _ => false
        };
        if (!matches) throw new InvalidImageException("Image contents do not match its extension.");
        try
        {
            source.Position = 0;
            var info = await Image.IdentifyAsync(source, ct);
            if (info.Width > 8192 || info.Height > 8192 || (long)info.Width * info.Height > MaxPixels)
                throw new InvalidImageException("Image dimensions are too large.");
            source.Position = 0;
            using var image = await Image.LoadAsync(new DecoderOptions { SkipMetadata = true, MaxFrames = 2 }, source, ct);
            if (image.Frames.Count != 1) throw new InvalidImageException("Animated images are not accepted.");
            using var output = new MemoryStream();
            IImageEncoder encoder = extension switch
            { ".jpg" => new JpegEncoder { Quality = 85 }, ".png" => new PngEncoder(), _ => new WebpEncoder { Quality = 85 } };
            // Re-encoding removes trailing payloads and metadata; never trust an original filename.
            await image.SaveAsync(output, encoder, ct);
            if (output.Length > MaxBytes) throw new InvalidImageException("Encoded image exceeds 5 MiB.");
            return new(output.ToArray(), extension, contentType);
        }
        catch (InvalidImageException) { throw; }
        catch (Exception ex) when (ex is UnknownImageFormatException or InvalidImageContentException or NotSupportedException or ImageFormatException)
        { throw new InvalidImageException("The image is corrupt or unsupported."); }
    }
}
