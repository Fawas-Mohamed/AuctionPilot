using System.Security.Authentication;
using System.Text;
using System.Text.Json;
using AuctionApi.Data;
using AuctionApi.Models;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace AuctionPilot.AdminRecovery;

internal sealed record ResetInput(string ConnectionString, string? Email, string? Password, string? Mode);

internal static class Program
{
    private static int Reply(bool success, string code, string message, int exitCode = 1)
    {
        Console.WriteLine(JsonSerializer.Serialize(new { success, code, message }));
        return success ? 0 : exitCode;
    }

    private static async Task<int> Main(string[] args)
    {
        try
        {
            if (args.Length != 0 || !Console.IsInputRedirected)
                return Reply(false, "WrapperRequired", "Run tools/Reset-DemoAdminPassword.ps1. Do not put secrets in command arguments.", 2);
            // Read the redirected pipe directly; no console-window/code-page setup is needed.
            using var reader = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false, true));
            var input = JsonSerializer.Deserialize<ResetInput>(await reader.ReadToEndAsync(),
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (input == null) return Reply(false, "PrivateInputInvalid", "The wrapper did not send valid private input.", 2);
            var connection = DemoConnection.Parse(input.ConnectionString);
            if (input.Mode == "validate")
                return Reply(true, "ConnectionFormatChecked", "Connection format and demo target checked; database access has not been attempted.");
            if (input.Mode != null && input.Mode != "reset" && input.Mode != "create")
                return Reply(false, "PrivateInputInvalid", "Unsupported operation. Run the PowerShell wrapper.", 2);
            if (string.IsNullOrWhiteSpace(input.Email) || string.IsNullOrEmpty(input.Password))
                return Reply(false, "AccountInputMissing", "Administrator email and new password are required.", 2);
            var services = new ServiceCollection();
            services.AddLogging(logging => logging.ClearProviders());
            services.AddDataProtection().UseEphemeralDataProtectionProvider();
            services.AddDbContext<ApplicationDbContext>(options => options.UseNpgsql(connection.ConnectionString));
            services.AddIdentityCore<ApplicationUser>(AdminResetOperation.ConfigureIdentity)
                .AddRoles<IdentityRole>().AddEntityFrameworkStores<ApplicationDbContext>().AddDefaultTokenProviders();
            services.AddScoped<AdminResetOperation>();
            await using var provider = services.BuildServiceProvider();
            await using var scope = provider.CreateAsyncScope();
            var creating = input.Mode == "create";
            var operation = scope.ServiceProvider.GetRequiredService<AdminResetOperation>();
            var outcome = creating ? await operation.CreateAdminAsync(input.Email, input.Password)
                : await operation.ResetAsync(input.Email, input.Password);
            if (!outcome.Succeeded)
            {
                var code = outcome.ErrorCodes.FirstOrDefault() ?? "AccountResetRejected";
                var message = code switch {
                    "ExistingAccountRefused" or "DuplicateEmail" or "DuplicateUserName" => "An account already uses that email or username. Choose an unregistered email. No existing account was promoted or reset.",
                    "AdminRoleMissing" => "The Admin role was not found. No account was created and initialization was not rerun.",
                    "InvalidEmail" or "InvalidUserName" => "Enter a valid email address you control. No account was created.",
                    "AccountNotFound" => "No existing account matches the entered email. Check its spelling. No reset was committed.",
                    "AdministratorRequired" => "This account is not an administrator. No account was promoted or reset.",
                    "AccountBlocked" => "This account is administratively blocked. Password recovery does not unblock it.",
                    _ when outcome.ErrorCodes.Any(c => c.StartsWith("Password", StringComparison.Ordinal)) => "Password requirements were not met. Use 12 or more characters with uppercase, lowercase, a number and a symbol. No change was committed.",
                    _ => "Identity rejected the operation. No change was committed."
                };
                // Identity error descriptions can include user input; emit only fixed messages/codes.
                if (code is not ("AccountNotFound" or "AdministratorRequired" or "AccountBlocked" or "ExistingAccountRefused" or "DuplicateEmail" or "DuplicateUserName" or "AdminRoleMissing" or "InvalidEmail" or "InvalidUserName"))
                    code = outcome.ErrorCodes.Any(c => c.StartsWith("Password", StringComparison.Ordinal)) ? "PasswordPolicyFailed" : "AccountResetRejected";
                return Reply(false, code, message);
            }
            if (creating) return Reply(true, "AdminCreated", "SUCCESS: new administrator created and verified. Existing accounts and auction history preserved. Sign in with the new email and password you entered.");
            return Reply(true, "PasswordResetSucceeded", "SUCCESS: administrator password reset and verified. Temporary lockout cleared; old tokens invalidated. Account roles and auction history preserved. Sign in with your new password.");
        }
        catch (DemoConnectionException error) { return Reply(false, error.Code, error.Message, 2); }
        catch (Exception error) when (error is JsonException or DecoderFallbackException or ArgumentException)
        { return Reply(false, "PrivateInputInvalid", "Private input was invalid. Run the current PowerShell wrapper; do not enter secrets as command arguments.", 2); }
        catch (PostgresException error)
        {
            return error.SqlState switch {
                "28P01" or "28000" => Reply(false, "DatabaseAuthenticationFailed", "Database credentials were rejected. Copy the complete current connection value from Render again."),
                "3D000" => Reply(false, "DatabaseUnavailable", "The selected database was not found. Check Render's current connection setting."),
                "42P01" => Reply(false, "DatabaseSchemaUnavailable", "The required account tables were not found. Check the selected demo database; do not rerun initialization for recovery."),
                "42501" => Reply(false, "DatabasePermissionDenied", "The database role lacks required permission. Use the current service connection from Render."),
                _ => Reply(false, "DatabaseRequestFailed", "The database request failed. Try the new login before repeating a reset; technical details are withheld.")
            };
        }
        catch (NpgsqlException error)
        {
            for (Exception? cause = error; cause != null; cause = cause.InnerException)
            {
                if (cause is AuthenticationException)
                    return Reply(false, "DatabaseTlsFailed", "TLS verification failed. Check the current Neon host and SSL Mode=VerifyFull; do not disable verification.");
                if (cause is TimeoutException)
                    return Reply(false, "DatabaseTimeout", "Database access timed out. Check availability and try the new login before repeating a reset.");
            }
            return Reply(false, "DatabaseConnectionFailed", "The database connection failed. Check network access and the current Render connection; try the new login before repeating a reset.");
        }
        catch (Exception)
        { return Reply(false, "ResetUnconfirmed", "Administrator operation could not be confirmed. Try the new login before retrying. Secret technical details are withheld."); }
    }
}
