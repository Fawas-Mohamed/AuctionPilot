using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using AuctionApi.Data;
using AuctionApi.Hubs;
using AuctionApi.Models;
using AuctionApi.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;
// Preserve the previously supported secret aliases; canonical names use ASP.NET's "__" separator.
config["Jwt:Key"] ??= Environment.GetEnvironmentVariable("JWT_KEY");
if (string.IsNullOrWhiteSpace(config["Jwt:Key"])) config["Jwt:Key"] = Environment.GetEnvironmentVariable("JWT_KEY");
if (string.IsNullOrWhiteSpace(config["AdminSeed:Email"])) config["AdminSeed:Email"] = Environment.GetEnvironmentVariable("ADMIN_EMAIL");
if (string.IsNullOrWhiteSpace(config["AdminSeed:Password"])) config["AdminSeed:Password"] = Environment.GetEnvironmentVariable("ADMIN_PASSWORD");
var signingKey = config["Jwt:Key"];
if (string.IsNullOrWhiteSpace(signingKey) || Encoding.UTF8.GetByteCount(signingKey) < 32)
    throw new InvalidOperationException("Set Jwt__Key to a random secret of at least 32 bytes.");
if (string.IsNullOrWhiteSpace(config["Jwt:Issuer"]) || string.IsNullOrWhiteSpace(config["Jwt:Audience"]))
    throw new InvalidOperationException("Set Jwt__Issuer and Jwt__Audience.");
var connection = config.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connection)) throw new InvalidOperationException("Set ConnectionStrings__DefaultConnection.");
var connectionSettings = new NpgsqlConnectionStringBuilder(connection);
if (!builder.Environment.IsDevelopment() && !builder.Environment.IsEnvironment("Testing") && connectionSettings.SslMode != SslMode.VerifyFull)
    throw new InvalidOperationException("Production PostgreSQL connections require SSL Mode=VerifyFull.");
if (connectionSettings.MaxPoolSize > 10) connectionSettings.MaxPoolSize = 5;
connectionSettings.IncludeErrorDetail = false;
builder.Services.AddDbContext<ApplicationDbContext>(o => o.UseNpgsql(connectionSettings.ConnectionString));
// Explicit service transactions plus idempotency handle mutations. Do not add automatic transaction retries.
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(o =>
{
    o.User.RequireUniqueEmail = true;
    o.Lockout.MaxFailedAccessAttempts = 5;
    o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
}).AddEntityFrameworkStores<ApplicationDbContext>().AddDefaultTokenProviders();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<TokenUserValidator>();
builder.Services.AddAuthentication(o =>
{
    o.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    o.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(o =>
{
    o.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true, ValidateAudience = true, ValidateIssuerSigningKey = true, ValidateLifetime = true,
        ValidIssuer = config["Jwt:Issuer"], ValidAudience = config["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
        ValidAlgorithms = new[] { SecurityAlgorithms.HmacSha256 }, ClockSkew = TimeSpan.Zero
    };
    o.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var path = context.Request.Path;
            if (path.StartsWithSegments("/hubs/auction") || path.StartsWithSegments("/hubs/admin"))
                context.Token = context.Request.Query["access_token"];
            return Task.CompletedTask;
        },
        OnTokenValidated = async context =>
        {
            if (!await context.HttpContext.RequestServices.GetRequiredService<TokenUserValidator>().IsValidAsync(context.Principal))
                context.Fail("Session is no longer valid.");
        }
    };
});
builder.Services.ConfigureApplicationCookie(o =>
{
    o.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return Task.CompletedTask; };
    o.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = 403; return Task.CompletedTask; };
});
var origins = (config["CORS_ALLOWED_ORIGINS"] ?? "https://auction-pilot.vercel.app")
    .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
if (origins.Length == 0 || origins.Any(origin => !Uri.TryCreate(origin, UriKind.Absolute, out var uri) ||
    uri.AbsolutePath != "/" || uri.Query.Length != 0 || uri.Fragment.Length != 0 ||
    (!builder.Environment.IsDevelopment() && uri.Scheme != "https") || origin.Contains('*') || origin.EndsWith('/')))
    throw new InvalidOperationException("CORS_ALLOWED_ORIGINS must contain exact origins without trailing slashes.");
builder.Services.AddCors(o => o.AddPolicy("Frontend", p => p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedProto;
    o.ForwardLimit = 1;
    // Render is the sole public ingress to its private container. Do not trust forwarded host/client IP.
    if (config.GetValue<bool>("Proxy:TrustRender") && string.Equals(Environment.GetEnvironmentVariable("RENDER"), "true", StringComparison.OrdinalIgnoreCase))
    { o.KnownNetworks.Clear(); o.KnownProxies.Clear(); }
});
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.AddPolicy("auth", c => RateLimitPartition.GetFixedWindowLimiter(c.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.AddPolicy("uploads", c => RateLimitPartition.GetFixedWindowLimiter(c.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonymous",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.AddPolicy("bids", c => RateLimitPartition.GetFixedWindowLimiter(c.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonymous",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 60, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.Services.AddControllers(o => o.Filters.Add<AuctionFreshnessFilter>());
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSingleton<HubConnections>();
builder.Services.AddSingleton<CurrentUserHubFilter>();
builder.Services.AddSignalR(o => { o.AddFilter<CurrentUserHubFilter>(); o.EnableDetailedErrors = false; o.MaximumReceiveMessageSize = 16 * 1024; });
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<AuctionEvents>();
builder.Services.AddScoped<BidService>();
builder.Services.AddScoped<AuctionResolver>();
builder.Services.AddSingleton<AuctionReconciler>();
builder.Services.AddSingleton<AuctionSchedule>();
builder.Services.AddHostedService<AuctionCloserHostedService>();
builder.Services.AddHttpClient<IImageStorage, CloudinaryImageStorage>(c => c.Timeout = TimeSpan.FromSeconds(60));
builder.Services.AddScoped<ImageAssetService>();
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(port))
{
    if (!int.TryParse(port, out var portNumber) || portNumber is < 1024 or > 65535) throw new InvalidOperationException("Invalid PORT.");
    builder.WebHost.UseUrls($"http://0.0.0.0:{portNumber}");
}
var app = builder.Build();
await DemoInitializer.InitializeAsync(app.Services, config);
// Fail startup if the database/schema is unavailable. Never advertise healthy after a swallowed seed failure.
await app.Services.GetRequiredService<AuctionReconciler>().EnsureFreshAsync();
app.UseForwardedHeaders();
app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
{
    context.Response.StatusCode = 503;
    await context.Response.WriteAsJsonAsync(new { message = "Service temporarily unavailable. Please retry." });
}));
if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
else
{
    app.UseHsts();
    // Render terminates TLS and redirects HTTP at its edge; container health probes use HTTP.
    if (!string.Equals(Environment.GetEnvironmentVariable("RENDER"), "true", StringComparison.OrdinalIgnoreCase))
        app.UseHttpsRedirection();
}
app.UseRouting();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapGet("/health", () => Results.Ok(new { status = "ok", mode = "portfolio-demo" })).AllowAnonymous();
app.MapGet("/health/ready", async (ApplicationDbContext db, CancellationToken ct) =>
    await db.Database.CanConnectAsync(ct) ? Results.Ok(new { status = "ready" }) : Results.StatusCode(503)).AllowAnonymous();
app.MapControllers();
app.MapHub<AuctionHub>("/hubs/auction", o => o.CloseOnAuthenticationExpiration = true).RequireAuthorization();
app.MapHub<AdminHub>("/hubs/admin", o => o.CloseOnAuthenticationExpiration = true).RequireAuthorization(p => p.RequireRole("Admin"));
app.Run();
public partial class Program { }
