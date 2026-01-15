namespace AuctionApi.Dtos
{
    public class AuctionListDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = "";
        public string? Description { get; set; }
        public string? ImageUrl { get; set; }
        public decimal StartPrice { get; set; }
        public decimal CurrentPrice { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public string? SellerId { get; set; }
        public int BidCount { get; set; }
        public string Status { get; set; } = "";
    }
}
