using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace AuctionApi.Controllers;
[ApiController, Route("api/payments"), Authorize]
public class PaymentsController : ControllerBase
{
    [HttpPost("{**path}")]
    public IActionResult Disabled() => StatusCode(501, new { message = "Payments are unavailable in this portfolio demo. No money is collected." });
}
