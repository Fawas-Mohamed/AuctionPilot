namespace AuctionApi.Dtos
{
    public class CreateAuctionDto
    {
        public string Title { get; set; } = "";
        public string? Description { get; set; }
        public string? ImageUrl { get; set; }
        public decimal StartPrice { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public int? CategoryId { get; set; }
    }
}
