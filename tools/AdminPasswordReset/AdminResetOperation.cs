using AuctionApi.Data;
using AuctionApi.Models;
using Microsoft.AspNetCore.Identity;
using Npgsql;

namespace AuctionPilot.AdminRecovery;

public sealed class DemoConnectionException(string code, string message) : ArgumentException(message)
{
    public string Code { get; } = code;
}

public static class DemoConnection
{
    public static NpgsqlConnectionStringBuilder Parse(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new DemoConnectionException("ConnectionMissing", "Paste the complete ConnectionStrings__DefaultConnection value from Render.");
        var text = value.Trim();
        if (text.All(c => c is '*' or '\u2022' or '\u25cf'))
            throw new DemoConnectionException("ConnectionMasked", "A masked value was pasted. Reveal or copy the actual value in Render; do not paste asterisks.");
        if (text.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) || text.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
            throw new DemoConnectionException("ConnectionUrlUnsupported", "Copy Render's Npgsql value beginning Host=, rather than a PostgreSQL URL.");
        NpgsqlConnectionStringBuilder connection;
        try { connection = new NpgsqlConnectionStringBuilder(text); }
        catch (Exception error) when (error is ArgumentException or FormatException or OverflowException)
        { throw new DemoConnectionException("ConnectionFormatInvalid", "Paste the full Npgsql setting value beginning Host=, not its name, a masked value or surrounding quotes."); }
        var host = connection.Host;
        if (string.IsNullOrWhiteSpace(host) || Uri.CheckHostName(host) != UriHostNameType.Dns || !host.EndsWith(".neon.tech", StringComparison.OrdinalIgnoreCase))
            throw new DemoConnectionException("ConnectionHostRejected", "The host must be the fresh Neon demo host ending .neon.tech. Copy the current Render setting.");
        if (connection.Database != "auctionpilot_demo")
            throw new DemoConnectionException("ConnectionDatabaseRejected", "The selected database must be auctionpilot_demo. Copy its current connection from Render.");
        if (connection.SslMode != SslMode.VerifyFull)
            throw new DemoConnectionException("ConnectionTlsRequired", "The Npgsql setting must include SSL Mode=VerifyFull.");
        if (string.IsNullOrWhiteSpace(connection.Username) || string.IsNullOrEmpty(connection.Password))
            throw new DemoConnectionException("ConnectionCredentialsMissing", "The full connection must include its database username and password. Copy it privately from Render.");
        if (!string.IsNullOrEmpty(connection.SearchPath) && connection.SearchPath != "public")
            throw new DemoConnectionException("ConnectionSchemaRejected", "Use the demo's public schema and the current Render connection setting.");
        connection.Pooling = false;
        connection.Timeout = 30;
        connection.CommandTimeout = 30;
        connection.IncludeErrorDetail = false;
        connection.PersistSecurityInfo = false;
        return connection;
    }
}

public record ResetOutcome(bool Succeeded, string[] ErrorCodes);

// Offline operator tool only. No HTTP endpoint, initialization or schema changes.
public sealed class AdminResetOperation(ApplicationDbContext db, UserManager<ApplicationUser> users, RoleManager<IdentityRole> roles)
{
    public static void ConfigureIdentity(IdentityOptions options)
    {
        options.User.RequireUniqueEmail = true;
        options.Password.RequiredLength = 12;
        options.Password.RequireUppercase = true;
        options.Password.RequireLowercase = true;
        options.Password.RequireDigit = true;
        options.Password.RequireNonAlphanumeric = true;
    }

    public async Task<ResetOutcome> ResetAsync(string email, string password, CancellationToken ct = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var user = await users.FindByEmailAsync(email.Trim());
        if (user == null) return new(false, ["AccountNotFound"]);
        if (!await users.IsInRoleAsync(user, "Admin")) return new(false, ["AdministratorRequired"]);
        if (user.IsBlocked) return new(false, ["AccountBlocked"]);

        var token = await users.GeneratePasswordResetTokenAsync(user);
        var reset = await users.ResetPasswordAsync(user, token, password);
        if (!reset.Succeeded) return Failure(reset);
        // Clear temporary failed-login lockout, preserving administrative block/roles/history.
        var failures = await users.ResetAccessFailedCountAsync(user);
        if (!failures.Succeeded) return Failure(failures);
        var lockout = await users.SetLockoutEndDateAsync(user, null);
        if (!lockout.Succeeded) return Failure(lockout);
        if (!await users.CheckPasswordAsync(user, password))
            return new(false, ["PasswordVerificationFailed"]);
        await transaction.CommitAsync(ct);
        return new(true, []);
    }

    public async Task<ResetOutcome> CreateAdminAsync(string email, string password, CancellationToken ct = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        email = email.Trim();
        // Creation is explicit and refuses existing identities, including ordinary users.
        if (await users.FindByEmailAsync(email) != null || await users.FindByNameAsync(email) != null)
            return new(false, ["ExistingAccountRefused"]);
        if (!await roles.RoleExistsAsync("Admin")) return new(false, ["AdminRoleMissing"]);
        var user = new ApplicationUser { UserName = email, Email = email, DisplayName = "Administrator" };
        var created = await users.CreateAsync(user, password);
        if (!created.Succeeded) return Failure(created);
        var added = await users.AddToRoleAsync(user, "Admin");
        if (!added.Succeeded) return Failure(added);
        if (!await users.CheckPasswordAsync(user, password) || !await users.IsInRoleAsync(user, "Admin"))
            return new(false, ["AccountVerificationFailed"]);
        await transaction.CommitAsync(ct);
        return new(true, []);
    }

    private static ResetOutcome Failure(IdentityResult result) =>
        new(false, result.Errors.Select(error => error.Code).ToArray());
}
