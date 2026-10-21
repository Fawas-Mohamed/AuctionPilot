namespace AuctionApi.Dtos;

public class AdminUpdateAuctionDto : CreateAuctionDto
{
    // Editing closed history leaves it closed unless the administrator explicitly reopens it.
    public bool Reopen { get; set; }
}
