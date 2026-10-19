using System.Security.Claims;
using System.Text.Json;
using AuctionApi.Data;
using AuctionApi.Models;
using AuctionApi.Services;
using AuctionPilot.AdminRecovery;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Npgsql;
using Xunit;

namespace AuctionApi.Tests;

public class AdminPasswordResetTests : PostgresDatabase
{
    private const string Old = "SyntheticOnly!123";
    private const string Fresh = "SyntheticOnly!456";
    private ServiceProvider Provider(params IInterceptor[] interceptors)
    {
        var services = new ServiceCollection();
        services.AddLogging(logging => logging.ClearProviders());
        services.AddDataProtection().UseEphemeralDataProtectionProvider();
        services.AddDbContext<ApplicationDbContext>(options => options.UseNpgsql(ConnectionString).AddInterceptors(interceptors));
        services.AddIdentityCore<ApplicationUser>(AdminResetOperation.ConfigureIdentity)
            .AddRoles<IdentityRole>().AddEntityFrameworkStores<ApplicationDbContext>().AddDefaultTokenProviders();
        services.AddScoped<AdminResetOperation>();
        return services.BuildServiceProvider();
    }
    private static async Task<ApplicationUser> Account(IServiceProvider services, bool admin = true, bool blocked = false)
    {
        var roles = services.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var name in new[] { "Admin", "User" })
            if (!await roles.RoleExistsAsync(name)) Assert.True((await roles.CreateAsync(new(name))).Succeeded);
        var users = services.GetRequiredService<UserManager<ApplicationUser>>();
        var user = new ApplicationUser { Email = "recovery@example.invalid", UserName = "recovery@example.invalid",
            DisplayName = "Synthetic recovery account", PhoneNumber = "+94000000000", IsBlocked = blocked, LockoutEnabled = true };
        Assert.True((await users.CreateAsync(user, Old)).Succeeded);
        Assert.True((await users.AddToRoleAsync(user, "User")).Succeeded);
        if (admin) Assert.True((await users.AddToRoleAsync(user, "Admin")).Succeeded);
        return user;
    }
    private static ClaimsPrincipal Principal(ApplicationUser user) => new(new ClaimsIdentity(new[] {
        new Claim(ClaimTypes.NameIdentifier, user.Id), new Claim("security_stamp", user.SecurityStamp!),
        new Claim("exp", DateTimeOffset.UtcNow.AddMinutes(5).ToUnixTimeSeconds().ToString()),
        new Claim(ClaimTypes.Role, "Admin"), new Claim(ClaimTypes.Role, "User") }, "synthetic"));
    private static async Task<string> History(ApplicationDbContext db) => JsonSerializer.Serialize(new {
        Auctions = await db.Auctions.OrderBy(a => a.Id).Select(a => new { a.Id, a.Title, a.SellerId, a.CreatedById, a.CurrentPrice, a.BidCount, a.IsClosed, a.WinnerId, a.ClosedAt }).ToArrayAsync(),
        Bids = await db.Bids.OrderBy(b => b.Id).Select(b => new { b.Id, b.AuctionId, b.BidderId, b.Amount, b.RequestId, b.Time }).ToArrayAsync(),
        Notifications = await db.Notifications.OrderBy(n => n.Id).Select(n => new { n.Id, n.UserId, n.AuctionId, n.Title, n.Message, n.IsRead, n.CreatedAt }).ToArrayAsync()
    });

    [PostgresFact]
    public async Task Reset_preserves_identity_roles_history_and_rejects_old_tokens()
    {
        await using var provider = Provider(); await using var scope = provider.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await Account(scope.ServiceProvider); var id = user.Id; var oldPrincipal = Principal(user);
        var validator = new TokenUserValidator(users, TimeProvider.System);
        Assert.True(await validator.IsValidAsync(oldPrincipal));
        var auctionId = await AuctionAsync();
        await using (var db = NewContext()) {
            var auction = await db.Auctions.SingleAsync(a => a.Id == auctionId);
            auction.SellerId = id; auction.CreatedById = id; await db.SaveChangesAsync();
        }
        Assert.Equal(200, (await BidAsync(auctionId, "bidder-a", 20)).StatusCode);
        Assert.True((await CloseAsync(auctionId)).Changed);
        string before; await using (var db = NewContext()) before = await History(db);
        var outcome = await scope.ServiceProvider.GetRequiredService<AdminResetOperation>().ResetAsync(user.Email!, Fresh);
        Assert.True(outcome.Succeeded);
        Assert.True(await users.CheckPasswordAsync(user, Fresh)); Assert.False(await users.CheckPasswordAsync(user, Old));
        Assert.False(await validator.IsValidAsync(oldPrincipal)); Assert.True(await validator.IsValidAsync(Principal(user)));
        await using var after = NewContext(); var stored = await after.Users.SingleAsync(u => u.Id == id);
        Assert.Equal("recovery@example.invalid", stored.Email); Assert.Equal("Synthetic recovery account", stored.DisplayName);
        Assert.Equal("+94000000000", stored.PhoneNumber); Assert.False(stored.IsBlocked);
        Assert.Equal(new[] { "Admin", "User" }, (await users.GetRolesAsync(user)).Order().ToArray());
        Assert.Equal(before, await History(after));
    }

    [PostgresFact]
    public async Task Reset_clears_failed_login_counter_and_temporary_lockout()
    {
        await using var provider = Provider(); await using var scope = provider.CreateAsyncScope();
        var user = await Account(scope.ServiceProvider);
        user.AccessFailedCount = 5; user.LockoutEnd = DateTimeOffset.UtcNow.AddMinutes(15);
        Assert.True((await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().UpdateAsync(user)).Succeeded);
        Assert.True((await scope.ServiceProvider.GetRequiredService<AdminResetOperation>().ResetAsync(user.Email!, Fresh)).Succeeded);
        await using var db = NewContext(); var stored = await db.Users.SingleAsync(u => u.Id == user.Id);
        Assert.Equal(0, stored.AccessFailedCount); Assert.Null(stored.LockoutEnd); Assert.False(stored.IsBlocked);
    }

    [Theory]
    [InlineData(false, false, false, "AdministratorRequired")]
    [InlineData(true, true, false, "AccountBlocked")]
    [InlineData(true, false, true, "AccountNotFound")]
    public async Task Missing_ordinary_and_blocked_accounts_are_not_changed(bool admin, bool blocked, bool missing, string code)
    {
        await using var provider = Provider(); await using var scope = provider.CreateAsyncScope();
        var user = await Account(scope.ServiceProvider, admin, blocked); var hash = user.PasswordHash; var stamp = user.SecurityStamp;
        var outcome = await scope.ServiceProvider.GetRequiredService<AdminResetOperation>()
            .ResetAsync(missing ? "absent@example.invalid" : user.Email!, Fresh);
        Assert.False(outcome.Succeeded); Assert.Equal(new[] { code }, outcome.ErrorCodes);
        await using var db = NewContext(); var stored = await db.Users.SingleAsync(u => u.Id == user.Id);
        Assert.Equal(hash, stored.PasswordHash); Assert.Equal(stamp, stored.SecurityStamp); Assert.Equal(blocked, stored.IsBlocked);
        Assert.Equal(admin ? 2 : 1, await db.UserRoles.CountAsync(ur => ur.UserId == user.Id));
    }

    [PostgresFact]
    public async Task Invalid_password_leaves_password_stamp_and_lockout_unchanged()
    {
        await using var provider = Provider(); await using var scope = provider.CreateAsyncScope();
        var user = await Account(scope.ServiceProvider); user.AccessFailedCount = 5; user.LockoutEnd = DateTimeOffset.UtcNow.AddMinutes(15);
        Assert.True((await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().UpdateAsync(user)).Succeeded);
        var hash = user.PasswordHash; var stamp = user.SecurityStamp; var end = user.LockoutEnd;
        var outcome = await scope.ServiceProvider.GetRequiredService<AdminResetOperation>().ResetAsync(user.Email!, "weak");
        Assert.False(outcome.Succeeded); Assert.Contains("PasswordTooShort", outcome.ErrorCodes);
        await using var db = NewContext(); var stored = await db.Users.SingleAsync(u => u.Id == user.Id);
        Assert.Equal(hash, stored.PasswordHash); Assert.Equal(stamp, stored.SecurityStamp);
        Assert.Equal(5, stored.AccessFailedCount); Assert.Equal(end!.Value.ToUnixTimeMilliseconds(), stored.LockoutEnd!.Value.ToUnixTimeMilliseconds());
    }

    [PostgresFact]
    public async Task Failure_after_password_SQL_rolls_back_password_and_security_stamp()
    {
        string id, hash, stamp;
        await using (var seed = Provider()) { await using var scope = seed.CreateAsyncScope(); var user = await Account(scope.ServiceProvider); id = user.Id; hash = user.PasswordHash!; stamp = user.SecurityStamp!; }
        await using var provider = Provider(new FailAfterSaveInterceptor(false)); await using var failing = provider.CreateAsyncScope();
        await Assert.ThrowsAsync<InvalidOperationException>(() => failing.ServiceProvider.GetRequiredService<AdminResetOperation>()
            .ResetAsync("recovery@example.invalid", Fresh));
        await using var db = NewContext(); var stored = await db.Users.SingleAsync(u => u.Id == id);
        Assert.Equal(hash, stored.PasswordHash); Assert.Equal(stamp, stored.SecurityStamp);
    }
    [PostgresFact]
    public async Task Create_admin_verifies_new_credentials_and_preserves_other_accounts_and_history()
    {
        await using var provider = Provider(); await using var scope = provider.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var existing = await Account(scope.ServiceProvider, admin: false);
        var hash = existing.PasswordHash; var stamp = existing.SecurityStamp;
        var auctionId = await AuctionAsync();
        await using (var db = NewContext()) {
            var auction = await db.Auctions.SingleAsync(a => a.Id == auctionId);
            auction.SellerId = existing.Id; auction.CreatedById = existing.Id; await db.SaveChangesAsync();
        }
        Assert.Equal(200, (await BidAsync(auctionId, "bidder-a", 20)).StatusCode);
        Assert.True((await CloseAsync(auctionId)).Changed);
        string history; int count;
        await using (var db = NewContext()) { history = await History(db); count = await db.Users.CountAsync(); }
        var outcome = await scope.ServiceProvider.GetRequiredService<AdminResetOperation>()
            .CreateAdminAsync("new-admin@example.invalid", Fresh);
        Assert.True(outcome.Succeeded);
        var created = await users.FindByEmailAsync("new-admin@example.invalid"); Assert.NotNull(created);
        Assert.True(await users.CheckPasswordAsync(created, Fresh));
        Assert.Equal(new[] { "Admin" }, (await users.GetRolesAsync(created)).ToArray());
        Assert.False(created.IsBlocked); Assert.Null(created.LockoutEnd);
        await using var after = NewContext(); var previous = await after.Users.SingleAsync(u => u.Id == existing.Id);
        Assert.Equal(hash, previous.PasswordHash); Assert.Equal(stamp, previous.SecurityStamp);
        Assert.Equal(new[] { "User" }, (await users.GetRolesAsync(existing)).ToArray());
        Assert.Equal(count + 1, await after.Users.CountAsync()); Assert.Equal(history, await History(after));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Create_admin_refuses_existing_email_without_reset_or_promotion(bool admin)
    {
        await using var provider = Provider(); await using var scope = provider.CreateAsyncScope();
        var existing = await Account(scope.ServiceProvider, admin); var hash = existing.PasswordHash; var stamp = existing.SecurityStamp;
        int count; await using (var before = NewContext()) count = await before.Users.CountAsync();
        var result = await scope.ServiceProvider.GetRequiredService<AdminResetOperation>()
            .CreateAdminAsync("  " + existing.Email!.ToUpperInvariant() + "  ", Fresh);
        Assert.False(result.Succeeded); Assert.Equal(new[] { "ExistingAccountRefused" }, result.ErrorCodes);
        await using var db = NewContext(); var stored = await db.Users.SingleAsync(u => u.Id == existing.Id);
        Assert.Equal(hash, stored.PasswordHash); Assert.Equal(stamp, stored.SecurityStamp);
        Assert.Equal(count, await db.Users.CountAsync());
        Assert.Equal(admin ? 2 : 1, await db.UserRoles.CountAsync(ur => ur.UserId == existing.Id));
    }

    [Theory]
    [InlineData("new-admin@example.invalid", "weak", "PasswordTooShort")]
    [InlineData("not-an-email", Fresh, "InvalidEmail")]
    public async Task Create_admin_rejects_invalid_credentials_without_partial_accounts(string email, string password, string error)
    {
        await using var provider = Provider(); await using var scope = provider.CreateAsyncScope();
        await Account(scope.ServiceProvider); int count; await using (var before = NewContext()) count = await before.Users.CountAsync();
        var outcome = await scope.ServiceProvider.GetRequiredService<AdminResetOperation>().CreateAdminAsync(email, password);
        Assert.False(outcome.Succeeded); Assert.Contains(error, outcome.ErrorCodes);
        await using var db = NewContext(); Assert.Equal(count, await db.Users.CountAsync());
        Assert.False(await db.Users.AnyAsync(u => u.Email == email));
    }

    [PostgresFact]
    public async Task Create_admin_does_not_initialize_missing_roles()
    {
        await using var provider = Provider(); await using var scope = provider.CreateAsyncScope();
        int count; await using (var before = NewContext()) count = await before.Users.CountAsync();
        var result = await scope.ServiceProvider.GetRequiredService<AdminResetOperation>()
            .CreateAdminAsync("new-admin@example.invalid", Fresh);
        Assert.False(result.Succeeded); Assert.Equal(new[] { "AdminRoleMissing" }, result.ErrorCodes);
        await using var db = NewContext(); Assert.Equal(count, await db.Users.CountAsync()); Assert.Empty(await db.Roles.ToArrayAsync());
    }

    [PostgresFact]
    public async Task Role_assignment_SQL_failure_rolls_back_the_entire_new_admin()
    {
        await using (var seed = Provider()) { await using var scope = seed.CreateAsyncScope(); await Account(scope.ServiceProvider); }
        int count; await using (var before = NewContext()) count = await before.Users.CountAsync();
        await using var provider = Provider(new FailSecondAdminSaveInterceptor()); await using var failing = provider.CreateAsyncScope();
        await Assert.ThrowsAsync<InvalidOperationException>(() => failing.ServiceProvider.GetRequiredService<AdminResetOperation>()
            .CreateAdminAsync("new-admin@example.invalid", Fresh));
        await using var db = NewContext(); Assert.Equal(count, await db.Users.CountAsync());
        Assert.False(await db.Users.AnyAsync(u => u.Email == "new-admin@example.invalid"));
    }

}

public class AdminRecoveryConnectionTests
{
    private static NpgsqlConnectionStringBuilder Settings() => new() { Host = "ep-synthetic-pooler.ap-southeast-1.aws.neon.tech",
        Database = "auctionpilot_demo", Username = "synthetic_role", Password = "synthetic-only", SslMode = SslMode.VerifyFull };
    [Fact]
    public void Neon_demo_uses_TLS_no_pooling_and_no_error_details()
    {
        var result = DemoConnection.Parse(Settings().ConnectionString);
        Assert.Equal(SslMode.VerifyFull, result.SslMode); Assert.False(result.Pooling); Assert.False(result.IncludeErrorDetail);
    }
    [Theory]
    [InlineData("Host", "127.0.0.1")]
    [InlineData("Host", "azure.database.windows.net")]
    [InlineData("Host", "one.neon.tech,other.neon.tech")]
    [InlineData("Database", "postgres")]
    [InlineData("SSL Mode", "Require")]
    [InlineData("Username", "")]
    [InlineData("Password", "")]
    [InlineData("Search Path", "other_schema")]
    public void Wrong_database_host_TLS_or_missing_credentials_are_rejected(string key, string value)
    {
        var settings = Settings(); settings[key] = value;
        Assert.ThrowsAny<ArgumentException>(() => DemoConnection.Parse(settings.ConnectionString));
    }
}

public sealed class FailSecondAdminSaveInterceptor : SaveChangesInterceptor
{
    private int saves;
    public override ValueTask<int> SavedChangesAsync(SaveChangesCompletedEventData data, int result, CancellationToken ct = default)
    {
        if (++saves == 2) throw new InvalidOperationException("Injected failure after new-admin role SQL.");
        return ValueTask.FromResult(result);
    }
}
