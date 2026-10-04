using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using AuctionApi.Services;
using AuctionApi.Utils;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using Xunit;
namespace AuctionApi.Tests;

public class ImageValidationTests
{
    private static FormFile File(byte[] bytes, string name, string mime) =>
        new(new MemoryStream(bytes), 0, bytes.Length, "file", name) { Headers = new HeaderDictionary(), ContentType = mime };
    [Theory]
    [InlineData(".jpg", "image/jpeg")]
    [InlineData(".png", "image/png")]
    [InlineData(".webp", "image/webp")]
    public async Task Valid_images_are_decoded_reencoded_and_strip_trailing_content(string extension, string mime)
    {
        using var image = new Image<Rgba32>(3, 3); using var stream = new MemoryStream();
        if (extension == ".jpg") await image.SaveAsJpegAsync(stream);
        else if (extension == ".png") await image.SaveAsPngAsync(stream);
        else await image.SaveAsWebpAsync(stream);
        var bytes = stream.ToArray().Concat(Encoding.UTF8.GetBytes("<script>trailing-payload</script>")).ToArray();
        var result = await ImageUploadValidation.ValidateAsync(File(bytes, "../../photo" + extension, mime));
        using var decoded = Image.Load(result.Bytes); Assert.Equal(3, decoded.Width);
        Assert.DoesNotContain("trailing-payload", Encoding.UTF8.GetString(result.Bytes));
        Assert.Equal(extension, result.Extension);
    }
    [Theory]
    [InlineData("photo.png", "image/png", "html")]
    [InlineData("photo.svg", "image/svg+xml", "html")]
    [InlineData("photo.jpg", "image/png", "jpeg")]
    [InlineData("photo.jpg", "image/jpeg", "jpeg")]
    [InlineData("photo.webp", "image/webp", "webp")]
    [InlineData("photo.png", "image/png", "empty")]
    [InlineData("photo.jpg", "image/jpeg", "large")]
    public async Task Spoofed_corrupt_mismatched_empty_and_large_files_are_rejected(string name, string mime, string kind)
    {
        var bytes = kind switch
        {
            "jpeg" => new byte[] {255,216,255},
            "webp" => Encoding.ASCII.GetBytes("RIFF0000WEBP"),
            "empty" => Array.Empty<byte>(), "large" => new byte[ImageUploadValidation.MaxBytes + 1],
            _ => Encoding.UTF8.GetBytes("<script>alert(1)</script>")
        };
        await Assert.ThrowsAsync<InvalidImageException>(() => ImageUploadValidation.ValidateAsync(File(bytes, name, mime)));
    }
    [Fact]
    public async Task Cloudinary_upload_is_server_signed_and_safely_named()
    {
        var values = new Dictionary<string, string>();
        var handler = new DelegateHandler(async request =>
        {
            Assert.Equal("https://api.cloudinary.com/v1_1/demo/image/upload", request.RequestUri!.ToString());
            foreach (var part in (MultipartFormDataContent)request.Content!)
            {
                var name = part.Headers.ContentDisposition!.Name!.Trim('"');
                if (name == "file") Assert.Matches(@"^[a-f0-9]{32}\.png$", part.Headers.ContentDisposition.FileName!.Trim('"'));
                else values[name] = await part.ReadAsStringAsync();
            }
            var publicId = values["public_id"];
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(JsonSerializer.Serialize(new
                { asset_id = "synthetic-asset", public_id = publicId, secure_url = "https://res.cloudinary.com/demo/image/upload/" + publicId + ".png", bytes = 10 })) };
        });
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>
            { ["Cloudinary:CloudName"] = "demo", ["Cloudinary:ApiKey"] = "synthetic-key", ["Cloudinary:ApiSecret"] = "synthetic-secret" }).Build();
        var storage = new CloudinaryImageStorage(new HttpClient(handler), config);
        var result = await storage.UploadAsync(new ValidatedImage(new byte[] { 1 }, ".png", "image/png"), default);
        Assert.StartsWith("auctionpilot-demo/", result.PublicId); Assert.Equal("false", values["overwrite"]);
        var expected = System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(
            "overwrite=false&public_id=" + values["public_id"] + "&timestamp=" + values["timestamp"] + "synthetic-secret"));
        Assert.Equal(Convert.ToHexString(expected).ToLowerInvariant(), values["signature"]);
        Assert.DoesNotContain("synthetic-secret", string.Join(",", values.Values));
    }
    [Fact]
    public async Task Fabricated_broadcast_methods_are_not_exposed_on_hub()
    {
        var methods = typeof(AuctionApi.Hubs.AuctionHub).GetMethods().Select(m => m.Name).ToArray();
        Assert.DoesNotContain("BroadcastBidPlaced", methods); Assert.DoesNotContain("BroadcastAuctionEnded", methods);
        await Task.CompletedTask;
    }
}
public class DelegateHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> handle) : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) => handle(request);
}
