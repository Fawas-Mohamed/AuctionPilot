using System.Security.Claims;
using AuctionApi.Data;
using AuctionApi.Hubs;
using AuctionApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

[Route("api/admin/users"), ApiController, Authorize(Roles = "Admin")]
public class AdminUsersController(UserManager<ApplicationUser> users, ApplicationDbContext db,
    IHubContext<AdminHub> hub, HubConnections connections) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        var result = new List<object>();
        foreach (var user in await users.Users.AsNoTracking().ToListAsync())
            result.Add(new { id = user.Id, name = user.DisplayName ?? user.UserName,
                email = user.Email, role = (await users.GetRolesAsync(user)).FirstOrDefault() ?? "User", user.IsBlocked });
        return Ok(result);
    }
    public record CreateUserDto(string Email, string Password, string DisplayName, string? Role);
    [HttpPost]
    public async Task<IActionResult> CreateUser(CreateUserDto dto)
    {
        var role = dto.Role ?? "User";
        if (role != "User" && role != "Admin") return BadRequest(new { message = "Invalid role." });
        await using var tx = await db.Database.BeginTransactionAsync();
        var user = new ApplicationUser { Email = dto.Email, UserName = dto.Email, DisplayName = dto.DisplayName };
        var created = await users.CreateAsync(user, dto.Password);
        if (!created.Succeeded) return BadRequest(created.Errors);
        var added = await users.AddToRoleAsync(user, role);
        if (!added.Succeeded) return BadRequest(added.Errors);
        await tx.CommitAsync();
        await Notify(user.Id);
        return Ok(new { id = user.Id, email = user.Email, displayName = user.DisplayName, role });
    }
    [HttpPatch("{id}/block")]
    public async Task<IActionResult> ToggleBlock(string id)
    {
        if (id == User.FindFirstValue(ClaimTypes.NameIdentifier)) return Conflict(new { message = "You cannot block your own admin account." });
        var user = await users.FindByIdAsync(id);
        if (user == null) return NotFound();
        await using var tx = await db.Database.BeginTransactionAsync();
        user.IsBlocked = !user.IsBlocked;
        var update = await users.UpdateAsync(user);
        if (!update.Succeeded) return BadRequest(update.Errors);
        var stamp = await users.UpdateSecurityStampAsync(user);
        if (!stamp.Succeeded) return BadRequest(stamp.Errors);
        await tx.CommitAsync();
        connections.DisconnectUser(id);
        await Notify(id);
        return NoContent();
    }
    [HttpPatch("{id}/role")]
    public async Task<IActionResult> ToggleRole(string id)
    {
        if (id == User.FindFirstValue(ClaimTypes.NameIdentifier)) return Conflict(new { message = "You cannot change your own admin role." });
        var user = await users.FindByIdAsync(id);
        if (user == null) return NotFound();
        await using var tx = await db.Database.BeginTransactionAsync();
        var admin = await users.IsInRoleAsync(user, "Admin");
        var removed = await users.RemoveFromRoleAsync(user, admin ? "Admin" : "User");
        if (!removed.Succeeded) return BadRequest(removed.Errors);
        var added = await users.AddToRoleAsync(user, admin ? "User" : "Admin");
        if (!added.Succeeded) return BadRequest(added.Errors);
        var stamp = await users.UpdateSecurityStampAsync(user);
        if (!stamp.Succeeded) return BadRequest(stamp.Errors);
        await tx.CommitAsync();
        connections.DisconnectUser(id);
        await Notify(id);
        return NoContent();
    }
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(string id)
    {
        if (id == User.FindFirstValue(ClaimTypes.NameIdentifier)) return Conflict(new { message = "You cannot delete your own admin account." });
        var user = await users.FindByIdAsync(id);
        if (user == null) return NotFound();
        if (await db.Auctions.AnyAsync(a => a.SellerId == id || a.CreatedById == id || a.WinnerId == id) ||
            await db.Bids.AnyAsync(b => b.BidderId == id) || await db.ImageAssets.AnyAsync(a => a.OwnerId == id))
            return Conflict(new { message = "This account has demo history. Block it to preserve auction and image records." });
        await using var tx = await db.Database.BeginTransactionAsync();
        await db.Watchlists.Where(w => w.UserId == id).ExecuteDeleteAsync();
        await db.Notifications.Where(n => n.UserId == id).ExecuteDeleteAsync();
        var deleted = await users.DeleteAsync(user);
        if (!deleted.Succeeded) return BadRequest(deleted.Errors);
        await tx.CommitAsync();
        connections.DisconnectUser(id);
        await Notify(id);
        return NoContent();
    }
    private async Task Notify(string id)
    {
        try { await hub.Clients.All.SendAsync("UserUpdated", id); }
        catch { }
    }
}
