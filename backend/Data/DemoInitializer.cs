using AuctionApi.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
namespace AuctionApi.Data;

public static class DemoInitializer
{
    public static async Task InitializeAsync(IServiceProvider services, IConfiguration config, CancellationToken ct = default)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        if (config.GetValue<bool>("Database:ApplyMigrations"))
        {
            // The initial PostgreSQL baseline may only initialize an empty database/schema.
            var applied = (await db.Database.GetAppliedMigrationsAsync(ct)).ToArray();
            if (applied.Length == 0)
            {
                await db.Database.OpenConnectionAsync(ct);
                await using var command = db.Database.GetDbConnection().CreateCommand();
                command.CommandText = "SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name <> '__EFMigrationsHistory'";
                if (Convert.ToInt64(await command.ExecuteScalarAsync(ct)) != 0)
                    throw new InvalidOperationException("Demo initialization requires an empty PostgreSQL database. Existing data is never reset.");
                await db.Database.CloseConnectionAsync();
            }
            await db.Database.MigrateAsync(ct);
        }
        if (!config.GetValue<bool>("Database:SeedDemo")) return;
        await using var seedTransaction = await db.Database.BeginTransactionAsync(ct);
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in new[] { "Admin", "User" })
            if (!await roles.RoleExistsAsync(role)) Require(await roles.CreateAsync(new IdentityRole(role)));
        var email = config["AdminSeed:Email"];
        var password = config["AdminSeed:Password"];
        if (!string.IsNullOrWhiteSpace(email) && !string.IsNullOrWhiteSpace(password))
        {
            var existing = await users.FindByEmailAsync(email);
            // Never promote an existing account by changing an environment variable.
            if (existing == null)
            {
                var admin = new ApplicationUser { UserName = email, Email = email, DisplayName = "Demo Administrator" };
                Require(await users.CreateAsync(admin, password));
                Require(await users.AddToRoleAsync(admin, "Admin"));
            }
        }
        if (!await db.Categories.AnyAsync(ct))
        {
            db.Categories.AddRange(new[] { "Fine Art", "Jewelry", "Watch", "Antiques", "Furniture" }.Select(name => new Category { Name = name }));
            await db.SaveChangesAsync(ct);
        }
        await seedTransaction.CommitAsync(ct);
    }
    private static void Require(IdentityResult result)
    {
        if (!result.Succeeded) throw new InvalidOperationException("Demo seed failed: " + string.Join(", ", result.Errors.Select(e => e.Code)));
    }
}
