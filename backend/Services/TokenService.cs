// Services/TokenService.cs
using AuctionApi.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace AuctionApi.Services
{
    public class TokenService : ITokenService
    {
        private readonly IConfiguration _config;
        public TokenService(IConfiguration config) => _config = config;

        public string CreateToken(ApplicationUser user, IList<string> roles)
        {
            if (user == null) throw new ArgumentNullException(nameof(user));

            var keyString = _config["Jwt:Key"];
            if (string.IsNullOrWhiteSpace(keyString))
                throw new InvalidOperationException("JWT signing key is not configured (Jwt:Key).");

            var claims = new List<Claim>
            {
                // sub is common for JWT; also include NameIdentifier so ASP.NET code can read user id easily
                new Claim(JwtRegisteredClaimNames.Sub, user.Id ?? ""),
                new Claim(ClaimTypes.NameIdentifier, user.Id ?? ""),
                new Claim(ClaimTypes.Name, user.UserName ?? ""),
                new Claim(JwtRegisteredClaimNames.Email, user.Email ?? "")
            };

            // add role claims
            if (roles != null)
            {
                foreach (var r in roles)
                {
                    if (!string.IsNullOrWhiteSpace(r))
                        claims.Add(new Claim(ClaimTypes.Role, r));
                }
            }

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(keyString));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            // token lifetime: adjust as needed
            var expires = DateTime.UtcNow.AddHours(6);

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: expires,
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
