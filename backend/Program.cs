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
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    db.Database.Migrate();

    var um = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    var rm = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();

    if (!rm.RoleExistsAsync("Admin").Result)
    {
        rm.CreateAsync(new IdentityRole("Admin")).Wait();
        rm.CreateAsync(new IdentityRole("User")).Wait();
    }

    if (um.FindByEmailAsync("admin@local").Result == null)
    {
        var admin = new ApplicationUser { Email = "admin@local", UserName = "admin@local", DisplayName = "Administrator" };
        var created = um.CreateAsync(admin, "Admin123!").Result;
        if (created.Succeeded) um.AddToRoleAsync(admin, "Admin").Wait();
    }

    // Seed sample auctions if none exist (dev)
    if (!db.Auctions.Any())
    {
        db.Auctions.AddRange(
            new Auction
            {
                Title = "Vintage Rolex Submariner 1970",
                Description = "An exceptional example of the iconic Rolex Submariner from 1970. Comes with original papers.",
                ImageUrl = "/uploads/watch-auction.jpg",
                StartPrice = 8000m,
                CurrentPrice = 8000m,
                StartTime = DateTime.UtcNow.AddDays(-1),
                EndTime = DateTime.UtcNow.AddDays(6),
                SellerId = null,
                Status = AuctionStatus.Live,
                BidCount = 0
            },
            new Auction
            {
                Title = "Contemporary Abstract Painting",
                Description = "Large contemporary painting, framed and ready to hang.",
                ImageUrl = "/uploads/painting.jpg",
                StartPrice = 5000m,
                CurrentPrice = 5000m,
                StartTime = DateTime.UtcNow.AddDays(-2),
                EndTime = DateTime.UtcNow.AddDays(4),
                SellerId = null,
                Status = AuctionStatus.Live,
                BidCount = 0
            }
        );

        db.SaveChanges();
    }
    // after applying migrations and creating roles/users:
    if (!db.Categories.Any())
    {
        var categories = new[]
        {
        new Category { Name = "Fine Art" },
        new Category { Name = "Jewelry" },
        new Category { Name = "Watch" },
        new Category { Name = "Antiques" },
        new Category { Name = "Furniture" }
    };
        db.Categories.AddRange(categories);
        db.SaveChanges();
    }

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