using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using AuctionApi.Data;
using AuctionApi.Services;
using AuctionApi.Utils;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using Xunit;
namespace AuctionApi.Tests;

public class DemoApiFactory(string connection, FakeImageStorage storage) : WebApplicationFactory<Program>
{
    protected override IHost CreateHost(IHostBuilder builder)
    {
        // Minimal hosting reads secrets before ConfigureAppConfiguration runs.
        // Give the real startup validator synthetic environment settings and restore them afterward.
        var settings = new Dictionary<string, string>
        {
            ["Jwt__Key"] = "synthetic-test-only-key-32-bytes-abcdef012345",
            ["ConnectionStrings__DefaultConnection"] = connection,
            ["Database__ApplyMigrations"] = "false", ["Database__SeedDemo"] = "true",
            ["AdminSeed__Email"] = "admin@demo.test", ["AdminSeed__Password"] = "SyntheticOnly!123"
        };
        var previous = settings.Keys.ToDictionary(key => key, Environment.GetEnvironmentVariable);
        try
        {
            foreach (var pair in settings) Environment.SetEnvironmentVariable(pair.Key, pair.Value);
            return base.CreateHost(builder);
        }
        finally
        {
            foreach (var pair in previous) Environment.SetEnvironmentVariable(pair.Key, pair.Value);
        }
    }
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = connection,
            ["Jwt:Key"] = "synthetic-test-only-key-32-bytes-abcdef012345",
            ["Jwt:Issuer"] = "AuctionAPI", ["Jwt:Audience"] = "AuctionClient",
            ["Database:ApplyMigrations"] = "false", ["Database:SeedDemo"] = "true",
            ["AdminSeed:Email"] = "admin@demo.test", ["AdminSeed:Password"] = "SyntheticOnly!123",
            ["CORS_ALLOWED_ORIGINS"] = "https://auction-pilot.vercel.app"
        }));
        builder.ConfigureServices(services =>
        {
            foreach (var hosted in services.Where(s => s.ServiceType == typeof(IHostedService) &&
                s.ImplementationType == typeof(AuctionCloserHostedService)).ToArray()) services.Remove(hosted);
            services.RemoveAll<IImageStorage>(); services.AddSingleton<IImageStorage>(storage);
        });
    }
}
public class FakeImageStorage : IImageStorage
{
    public bool Fail { get; set; }
    public Task<StoredImage> UploadAsync(ValidatedImage image, CancellationToken ct)
    {
        if (Fail) throw new ImageStorageException("Synthetic storage outage.");
        var id = Guid.NewGuid().ToString("N");
        return Task.FromResult(new StoredImage(id, "demo/" + id, "https://res.cloudinary.com/demo/image/upload/" + id + image.Extension, image.Bytes.Length));
    }
}

public class ApiSecurityTests : PostgresDatabase
{
    private DemoApiFactory? factory;
    private readonly FakeImageStorage storage = new();
    private HttpClient Client(string? token = null)
    {
        factory ??= new DemoApiFactory(ConnectionString, storage);
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });
        if (token != null) client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }
    private async Task<(string Token, string Id)> RegisterAsync(HttpClient client, string email = "bidder@demo.test")
    {
        var response = await client.PostAsJsonAsync("/api/auth/register", new { email, password = "SyntheticOnly!123", displayName = "Synthetic Bidder" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        return (json.GetProperty("token").GetString()!, json.GetProperty("user").GetProperty("id").GetString()!);
    }
    private async Task<string> AdminAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email = "admin@demo.test", password = "SyntheticOnly!123" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
    }
    private static async Task<MultipartFormDataContent> ImageForm(bool corrupt = false, int? length = null)
    {
        using var image = new Image<Rgba32>(2, 2);
        using var stream = new MemoryStream(); await image.SaveAsPngAsync(stream);
        var bytes = length != null ? new byte[length.Value] : corrupt ? new byte[] {137,80,78,71,13,10,26,10} : stream.ToArray();
        var form = new MultipartFormDataContent(); var content = new ByteArrayContent(bytes);
        content.Headers.ContentType = new MediaTypeHeaderValue("image/png"); form.Add(content, "file", "../../photo.png"); return form;
    }

    [PostgresFact]
    public async Task Registration_login_and_role_restrictions_apply_to_API_and_both_hubs()
    {
        using var anonymous = Client(); var account = await RegisterAsync(anonymous); using var user = Client(account.Token);
        Assert.Equal(HttpStatusCode.OK, (await user.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/admin/reports/today-sales")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await user.GetAsync("/api/admin/reports/today-sales")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsync("/hubs/auction/negotiate?negotiateVersion=1", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await user.PostAsync("/hubs/auction/negotiate?negotiateVersion=1", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await user.PostAsync("/hubs/admin/negotiate?negotiateVersion=1", null)).StatusCode);
        var adminToken = await AdminAsync(anonymous); using var admin = Client(adminToken);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/admin/reports/today-sales")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync("/api/dev/bids")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await anonymous.PostAsync("/hubs/admin/negotiate?negotiateVersion=1&access_token=" + adminToken, null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/account/profile?access_token=" + account.Token)).StatusCode);
        var login = await anonymous.PostAsJsonAsync("/api/auth/login", new { email = "bidder@demo.test", password = "SyntheticOnly!123" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }
    [PostgresFact]
    public async Task Blocked_and_role_changed_users_cannot_reuse_JWTs_or_hubs()
    {
        using var anonymous = Client(); var account = await RegisterAsync(anonymous);
        using var user = Client(account.Token); using var admin = Client(await AdminAsync(anonymous));
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PatchAsync("/api/admin/users/" + account.Id + "/block", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await user.GetAsync("/api/account/profile")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await user.PostAsync("/hubs/auction/negotiate?negotiateVersion=1", null)).StatusCode);
        using var file = await ImageForm(); Assert.Equal(HttpStatusCode.Unauthorized, (await user.PostAsync("/api/uploads", file)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PatchAsync("/api/admin/users/" + account.Id + "/block", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await user.GetAsync("/api/auth/me")).StatusCode);
        var login = await anonymous.PostAsJsonAsync("/api/auth/login", new { email = "bidder@demo.test", password = "SyntheticOnly!123" });
        var refreshed = (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
        using var current = Client(refreshed);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PatchAsync("/api/admin/users/" + account.Id + "/role", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await current.GetAsync("/api/auth/me")).StatusCode);
    }
    [PostgresFact]
    public async Task Upload_and_avatar_use_owned_Cloudinary_records_and_failures_never_report_success()
    {
        using var anonymous = Client(); var account = await RegisterAsync(anonymous); using var user = Client(account.Token);
        using (var file = await ImageForm()) Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsync("/api/uploads", file)).StatusCode);
        using (var corrupt = await ImageForm(corrupt: true)) Assert.Equal(HttpStatusCode.BadRequest, (await user.PostAsync("/api/uploads", corrupt)).StatusCode);
        using (var oversized = await ImageForm(length: ImageUploadValidation.MaxBytes + 1))
            Assert.Contains((await user.PostAsync("/api/uploads", oversized)).StatusCode, new[] { HttpStatusCode.BadRequest, HttpStatusCode.RequestEntityTooLarge });
        using (var file = await ImageForm()) Assert.Equal(HttpStatusCode.OK, (await user.PostAsync("/api/uploads", file)).StatusCode);
        using (var file = await ImageForm()) Assert.Equal(HttpStatusCode.OK, (await user.PostAsync("/api/account/avatar", file)).StatusCode);
        await using var db = NewContext();
        var original = await db.Users.AsNoTracking().SingleAsync(u => u.Id == account.Id);
        Assert.StartsWith("https://res.cloudinary.com/", original.AvatarUrl); Assert.NotNull(original.AvatarAssetId);
        Assert.Equal(2, await db.ImageAssets.CountAsync());
        storage.Fail = true;
        using (var file = await ImageForm()) Assert.Equal(HttpStatusCode.BadGateway, (await user.PostAsync("/api/uploads", file)).StatusCode);
        using (var file = await ImageForm()) Assert.Equal(HttpStatusCode.BadGateway, (await user.PostAsync("/api/account/avatar", file)).StatusCode);
        Assert.Equal(2, await db.ImageAssets.CountAsync());
        Assert.Equal(original.AvatarUrl, (await db.Users.AsNoTracking().SingleAsync(u => u.Id == account.Id)).AvatarUrl);
    }
    [PostgresFact]
    public async Task Public_responses_redact_Identity_and_wins_require_server_verified_closure()
    {
        using var anonymous = Client(); var account = await RegisterAsync(anonymous); using var user = Client(account.Token);
        var id = await AuctionAsync();
        var publicResponse = await anonymous.GetAsync("/api/auctions/" + id);
        Assert.Equal(HttpStatusCode.OK, publicResponse.StatusCode);
        var text = await publicResponse.Content.ReadAsStringAsync();
        foreach (var field in new[] { "passwordHash", "securityStamp", "concurrencyStamp", "normalizedEmail", "phoneNumber", "lockoutEnd", "email" })
            Assert.DoesNotContain(field, text, StringComparison.OrdinalIgnoreCase);
        var result = await user.GetFromJsonAsync<JsonElement>("/api/auctions/" + id + "/result");
        Assert.False(result.GetProperty("isWinner").GetBoolean());
        Assert.Equal(HttpStatusCode.NotImplemented, (await user.PostAsync("/api/payments/create-checkout-session/" + id, null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotImplemented, (await user.PostAsync("/api/consignments", null)).StatusCode);
    }
    [PostgresFact]
    public async Task UTC_inputs_cors_health_and_expired_auction_reconciliation_are_correct()
    {
        using var anonymous = Client(); var account = await RegisterAsync(anonymous); using var user = Client(account.Token);
        var start = DateTimeOffset.FromUnixTimeMilliseconds(DateTimeOffset.UtcNow.AddMinutes(5).ToUnixTimeMilliseconds()).ToOffset(TimeSpan.FromMinutes(330));
        var end = start.AddHours(1);
        var create = await user.PostAsJsonAsync("/api/auctions", new { title = "UTC synthetic lot", startPrice = 10, startTime = start, endTime = end });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var json = await create.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(TimeSpan.Zero, json.GetProperty("startTime").GetDateTimeOffset().Offset);
        Assert.Equal(start.ToUniversalTime(), json.GetProperty("startTime").GetDateTimeOffset());
        var invalid = await user.PostAsJsonAsync("/api/auctions", new { title = "Ambiguous date", startPrice = 10, startTime = "2026-10-05T10:00:00", endTime = "2026-10-05T11:00:00" });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/auctions");
        request.Headers.Add("Origin", "https://auction-pilot.vercel.app"); request.Headers.Add("Access-Control-Request-Method", "GET");
        var cors = await anonymous.SendAsync(request); Assert.Equal("https://auction-pilot.vercel.app", cors.Headers.GetValues("Access-Control-Allow-Origin").Single());
        using var untrusted = new HttpRequestMessage(HttpMethod.Options, "/api/auctions");
        untrusted.Headers.Add("Origin", "https://untrusted.vercel.app"); untrusted.Headers.Add("Access-Control-Request-Method", "GET");
        Assert.False((await anonymous.SendAsync(untrusted)).Headers.Contains("Access-Control-Allow-Origin"));
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync("/health")).StatusCode);
        var expired = await AuctionAsync(start: DateTimeOffset.UtcNow.AddHours(-2), end: DateTimeOffset.UtcNow.AddHours(-1));
        factory!.Services.GetRequiredService<AuctionReconciler>().Invalidate();
        var state = await anonymous.GetFromJsonAsync<JsonElement>("/api/auctions/" + expired);
        Assert.True(state.GetProperty("isClosed").GetBoolean()); Assert.Equal(3, state.GetProperty("status").GetInt32());
    }
    [PostgresFact]
    public async Task SignalR_reconnect_recovers_stored_notifications_and_clients_cannot_fabricate_events()
    {
        using var anonymous = Client();
        var account = await RegisterAsync(anonymous);
        using var user = Client(account.Token);
        using var admin = Client(await AdminAsync(anonymous));
        var id = await AuctionAsync();
        await using var connection = new HubConnectionBuilder().WithUrl("https://localhost/hubs/auction", options =>
        {
            options.Transports = HttpTransportType.LongPolling;
            options.HttpMessageHandlerFactory = _ => factory!.Server.CreateHandler();
            options.AccessTokenProvider = () => Task.FromResult<string?>(account.Token);
        }).Build();
        await connection.StartAsync();
        await connection.InvokeAsync("JoinAuctionRoom", id.ToString());
        await Assert.ThrowsAsync<HubException>(() => connection.InvokeAsync("BroadcastBidPlaced", id.ToString(), new { amount = 99999 }));
        await Assert.ThrowsAsync<HubException>(() => connection.InvokeAsync("BroadcastAuctionEnded", id.ToString(), new { winnerId = account.Id }));
        var request = new { amount = 20, requestId = Guid.NewGuid() };
        Assert.Equal(HttpStatusCode.OK, (await user.PostAsJsonAsync("/api/auctions/" + id + "/placebid", request)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await user.PostAsJsonAsync("/api/auctions/" + id + "/placebid", request)).StatusCode);
        await connection.StopAsync();
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsync("/api/auctions/" + id + "/close", null)).StatusCode);
        await connection.StartAsync();
        await connection.InvokeAsync("JoinAuctionRoom", id.ToString());
        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsync("/api/admin/auctions/" + id + "/close", null)).StatusCode);
        var notifications = await user.GetFromJsonAsync<JsonElement[]>("/api/notifications");
        Assert.Single(notifications!);
        var result = await user.GetFromJsonAsync<JsonElement>("/api/auctions/" + id + "/result");
        Assert.True(result.GetProperty("isWinner").GetBoolean());
        await using var db = NewContext(); Assert.Equal(1, await db.Bids.CountAsync());
        var closed = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        connection.Closed += _ => { closed.TrySetResult(); return Task.CompletedTask; };
        await admin.PatchAsync("/api/admin/users/" + account.Id + "/block", null);
        await closed.Task.WaitAsync(TimeSpan.FromSeconds(10));
        Assert.Equal(HubConnectionState.Disconnected, connection.State);
    }

    public override async Task DisposeAsync()
    {
        if (factory != null) await factory.DisposeAsync();
        await base.DisposeAsync();
    }
}
