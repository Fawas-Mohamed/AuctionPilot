using Microsoft.AspNetCore.Http;

namespace AuctionApi.Models
{
    public class ImageUploadDto
    {
        public IFormFile File { get; set; }
    }
}
