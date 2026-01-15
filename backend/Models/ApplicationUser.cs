using Microsoft.AspNetCore.Identity;

namespace AuctionApi.Models
{
    public class ApplicationUser : IdentityUser
    {
        public string? DisplayName { get; set; }
        public bool IsBlocked { get; set; } = false;
        public string? AvatarUrl { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
       


    }
}
