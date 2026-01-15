// Controllers/AuthController.cs
using AuctionApi.Models;
using AuctionApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace AuctionApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _um;
        private readonly SignInManager<ApplicationUser> _sm;
        private readonly ITokenService _ts;

        public AuthController(UserManager<ApplicationUser> um, SignInManager<ApplicationUser> sm, ITokenService ts)
        {
            _um = um;
            _sm = sm;
            _ts = ts;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
        {
            var user = new ApplicationUser
            {
                UserName = dto.Email,
                Email = dto.Email,
                DisplayName = dto.DisplayName
            };

            var result = await _um.CreateAsync(user, dto.Password);
            if (!result.Succeeded) return BadRequest(result.Errors);

            // default role
            await _um.AddToRoleAsync(user, "User");

            var roles = await _um.GetRolesAsync(user);
            var token = _ts.CreateToken(user, roles);

            return Ok(new
            {
                token,
                user = new
                {
                    user.Id,
                    user.Email,
                    user.DisplayName,
                    roles
                }
            });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            var user = await _um.FindByEmailAsync(dto.Email);
            if (user == null) return Unauthorized("Invalid credentials");

            if (user.IsBlocked)
                return Unauthorized("Account is blocked.");


            var result = await _sm.CheckPasswordSignInAsync(user, dto.Password, false);
            if (!result.Succeeded) return Unauthorized("Invalid credentials");

            var roles = await _um.GetRolesAsync(user);
            var token = _ts.CreateToken(user, roles);

            return Ok(new
            {
                token,
                user = new
                {
                    user.Id,
                    user.Email,
                    user.DisplayName,
                    roles
                }
            });
        }

        [HttpGet("me")]
        [Authorize]
        public async Task<IActionResult> Me()
        {
            var user = await _um.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var roles = await _um.GetRolesAsync(user);

            return Ok(new
            {
                id = user.Id,
                email = user.Email,
                displayName = user.DisplayName,
                roles
            });
        }
    }

    public record RegisterDto(string Email, string Password, string DisplayName);
    public record LoginDto(string Email, string Password);
}
