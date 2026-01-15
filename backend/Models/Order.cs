using AuctionApi.Models;

public class Order
{
    public int Id { get; set; }

    public int AuctionId { get; set; }
    public Auction Auction { get; set; } = null!;

    public string BuyerId { get; set; } = "";
    public ApplicationUser? Buyer { get; set; }

    public decimal Amount { get; set; }
    public string Currency { get; set; } = "USD";

    // Payment provider (Stripe/PayPal) metadata
    public string? PaymentProvider { get; set; }
    public string? PaymentProviderId { get; set; } // PaymentIntent/Session id

    public string Status { get; set; } = "PendingPayment"; // PendingPayment, Paid, Failed, Expired, Cancelled
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }
}
