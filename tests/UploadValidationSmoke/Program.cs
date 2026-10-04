using System.Text;
using AuctionApi.Utils;
using Microsoft.AspNetCore.Http;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;

var count = 0;
foreach (var (extension, mime) in new[] { (".jpg", "image/jpeg"), (".png", "image/png"), (".webp", "image/webp") })
{
    using var image = new Image<Rgba32>(2, 2);
    using var stream = new MemoryStream();
    if (extension == ".jpg") await image.SaveAsJpegAsync(stream);
    else if (extension == ".png") await image.SaveAsPngAsync(stream);
    else await image.SaveAsWebpAsync(stream);
    var bytes = stream.ToArray().Concat(Encoding.UTF8.GetBytes("<script>untrusted-tail</script>")).ToArray();
    var file = new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", "../../photo" + extension)
        { Headers = new HeaderDictionary(), ContentType = mime };
    var safe = await ImageUploadValidation.ValidateAsync(file);
    using var decoded = Image.Load(safe.Bytes);
    if (decoded.Width != 2 || Encoding.UTF8.GetString(safe.Bytes).Contains("untrusted-tail"))
        throw new Exception("Image re-encoding failed.");
    count++;
}
foreach (var (name, bytes, mime) in new[]
{
    ("fake.png", Encoding.UTF8.GetBytes("<script>alert(1)</script>"), "image/png"),
    ("truncated.jpg", new byte[] {255,216,255}, "image/jpeg"),
    ("truncated.webp", Encoding.ASCII.GetBytes("RIFF0000WEBP"), "image/webp"),
    ("empty.jpg", Array.Empty<byte>(), "image/jpeg"),
    ("large.jpg", new byte[ImageUploadValidation.MaxBytes + 1], "image/jpeg"),
    ("mismatched.svg", new byte[] {255,216,255}, "image/svg+xml")
})
{
    var file = new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", name)
        { Headers = new HeaderDictionary(), ContentType = mime };
    try { await ImageUploadValidation.ValidateAsync(file); throw new Exception("Unsafe image was accepted: " + name); }
    catch (InvalidImageException) { count++; }
}
Console.WriteLine($"PASS: {count} full-decoding, content/type/size and safe re-encoding cases.");
