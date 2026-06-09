// Program.cs
using AuctionApi.Data;
using AuctionApi.Hubs;
using AuctionApi.Models;
using AuctionApi.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// DbContext
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(config.GetConnectionString("DefaultConnection")));

// Identity (keep it, but ensure API behavior for unauthenticated requests)
builder.Services.AddIdentity<ApplicationUser, IdentityRole>()
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

// JWT Auth
var jwtKey = config["Jwt:Key"];

if (string.IsNullOrEmpty(jwtKey))
    throw new Exception("JWT Key is missing in appsettings.json");

var key = Encoding.UTF8.GetBytes(jwtKey);
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false; // true in prod
    options.SaveToken = true;
    options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = config["Jwt:Issuer"],
        ValidAudience = config["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ClockSkew = TimeSpan.Zero
    };

    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/auction"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

// Prevent Identity cookie middleware from redirecting API calls to login (breaks CORS)
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Events.OnRedirectToLogin = ctx =>
    {
        ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = ctx =>
    {
        ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    };
});

// CORS - include frontend origins (adjust the ports you actually use)
var allowedOrigins = new[] {
    "http://localhost:8080",
    "http://localhost:8081",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:8081",
    "http://localhost:5173"
};

builder.Services.AddCors(options =>
{
    options.AddPolicy("DevCors", policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

builder.Services.AddControllers().AddJsonOptions(opts =>
{
    // Use camelCase JSON (default) - keeps frontend comfortable
    opts.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;

    // ✅ Prevent circular reference errors (Auction <-> Bids loops)
    opts.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// SignalR
builder.Services.AddSignalR();

// Token service
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<AuctionResolver>();
builder.Services.AddHostedService<AuctionCloserHostedService>();

var app = builder.Build();

// Apply migrations & seed at startup (dev convenience)
try
{
    using var scope = app.Services.CreateScope();

    var logger = scope.ServiceProvider
        .GetRequiredService<ILogger<Program>>();

    var db = scope.ServiceProvider
        .GetRequiredService<ApplicationDbContext>();

    logger.LogInformation("Applying database migrations...");

    await db.Database.MigrateAsync();

    logger.LogInformation("Database migration completed.");

    var um = scope.ServiceProvider
        .GetRequiredService<UserManager<ApplicationUser>>();

    var rm = scope.ServiceProvider
        .GetRequiredService<RoleManager<IdentityRole>>();

    // Roles
    if (!await rm.RoleExistsAsync("Admin"))
    {
        await rm.CreateAsync(new IdentityRole("Admin"));
    }

    if (!await rm.RoleExistsAsync("User"))
    {
        await rm.CreateAsync(new IdentityRole("User"));
    }

    // Admin User
    var admin = await um.FindByEmailAsync("admin@local");

    if (admin == null)
    {
        admin = new ApplicationUser
        {
            Email = "admin@local",
            UserName = "admin@local",
            DisplayName = "Administrator"
        };

        var result = await um.CreateAsync(admin, "Admin123!");

        if (result.Succeeded)
        {
            await um.AddToRoleAsync(admin, "Admin");
        }
    }

    // Categories
    if (!await db.Categories.AnyAsync())
    {
        db.Categories.AddRange(
            new Category { Name = "Fine Art" },
            new Category { Name = "Jewelry" },
            new Category { Name = "Watch" },
            new Category { Name = "Antiques" },
            new Category { Name = "Furniture" }
        );

        await db.SaveChangesAsync();
    }

    logger.LogInformation("Startup seed completed.");
}
catch (Exception ex)
{
    Console.WriteLine($"STARTUP ERROR: {ex}");
}

app.UseSwagger();
app.UseSwaggerUI();

// Important ordering
app.UseRouting();

// Apply CORS BEFORE authentication & before endpoints
app.UseCors("DevCors");

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

// Serve static files so uploaded images under wwwroot/uploads are reachable


app.MapControllers();
app.MapHub<AuctionHub>("/hubs/auction");
app.MapHub<AdminHub>("/hubs/admin");

app.Run();