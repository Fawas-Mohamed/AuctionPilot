using AuctionApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

[Route("api/admin/users")]
[ApiController]
[Authorize(Roles = "Admin")]
public class AdminUsersController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IHubContext<AdminHub> _hub;

    public AdminUsersController(UserManager<ApplicationUser> userManager, IHubContext<AdminHub> hub)
    {
        _userManager = userManager;
        _hub = hub;
    }

    // GET /api/admin/users
    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        var users = _userManager.Users.ToList()
            .Select(u => new {
                id = u.Id,
                name = u.DisplayName ?? u.UserName,
                email = u.Email,
                role = _userManager.GetRolesAsync(u).Result.FirstOrDefault() ?? "User",
                isBlocked = u.IsBlocked
            });

        return Ok(users);
    }

    // POST /api/admin/users
    // Body: { email, password, displayName, role } role optional (USER|ADMIN)
    public record CreateUserDto(string Email, string Password, string DisplayName, string? Role);

    [HttpPost]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserDto dto)
    {
        var u = new ApplicationUser
        {
            UserName = dto.Email,
            Email = dto.Email,
            DisplayName = dto.DisplayName
        };

        var create = await _userManager.CreateAsync(u, dto.Password);
        if (!create.Succeeded) return BadRequest(create.Errors);

        var role = string.IsNullOrEmpty(dto.Role) ? "User" : dto.Role;
        if (!await _userManager.IsInRoleAsync(u, role))
            await _userManager.AddToRoleAsync(u, role);

        await _hub.Clients.All.SendAsync("UserUpdated", u.Id);
        return Ok(new { id = u.Id, email = u.Email, displayName = u.DisplayName, role });
    }

    // PATCH /api/admin/users/{id}/block
    [HttpPatch("{id}/block")]
    public async Task<IActionResult> ToggleBlock(string id)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound();

        user.IsBlocked = !user.IsBlocked;
        var res = await _userManager.UpdateAsync(user);
        if (!res.Succeeded) return BadRequest(res.Errors);

        // Important: update security stamp to invalidate existing tokens
        await _userManager.UpdateSecurityStampAsync(user);

        await _hub.Clients.All.SendAsync("UserUpdated", user.Id);
        return NoContent();
    }

    // PATCH /api/admin/users/{id}/role
    [HttpPatch("{id}/role")]
    public async Task<IActionResult> ToggleRole(string id)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound();

        var roles = await _userManager.GetRolesAsync(user);
        if (roles.Contains("Admin"))
        {
            await _userManager.RemoveFromRoleAsync(user, "Admin");
            await _userManager.AddToRoleAsync(user, "User");
        }
        else
        {
            await _userManager.RemoveFromRoleAsync(user, "User");
            await _userManager.AddToRoleAsync(user, "Admin");
        }

        // invalidate tokens (force re-login for role changes)
        await _userManager.UpdateSecurityStampAsync(user);

        await _hub.Clients.All.SendAsync("UserUpdated", user.Id);
        return NoContent();
    }

    // DELETE /api/admin/users/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(string id)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user == null) return NotFound();

        var res = await _userManager.DeleteAsync(user);
        if (!res.Succeeded) return BadRequest(res.Errors);

        await _hub.Clients.All.SendAsync("UserUpdated", id);
        return NoContent();
    }
}
