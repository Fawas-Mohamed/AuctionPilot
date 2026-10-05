using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using AuctionApi.Models;
namespace AuctionApi.Services;

public class TokenUserValidator(UserManager<ApplicationUser> users, TimeProvider clock)
{
    public async Task<bool> IsValidAsync(ClaimsPrincipal? principal)
    {
        if (principal?.Identity?.IsAuthenticated != true) return false;
        var user = await users.FindByIdAsync(principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? "");
        if (user == null || user.IsBlocked || (user.LockoutEnd != null && user.LockoutEnd > clock.GetUtcNow())) return false;
        var stamp = principal.FindFirstValue("security_stamp");
        if (string.IsNullOrEmpty(stamp) || stamp != user.SecurityStamp) return false;
        var expires = principal.FindFirstValue("exp");
        if (!long.TryParse(expires, out var seconds) || clock.GetUtcNow().ToUnixTimeSeconds() >= seconds) return false;
        var roles = await users.GetRolesAsync(user);
        return roles.Order(StringComparer.Ordinal).SequenceEqual(
            principal.FindAll(ClaimTypes.Role).Select(c => c.Value).Order(StringComparer.Ordinal), StringComparer.Ordinal);
    }
}
