using AuctionApi.Models;

namespace AuctionApi.Services
{
    public interface ITokenService
    {
        string CreateToken(ApplicationUser user, IList<string> roles);
    }
}
