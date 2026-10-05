using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace AuctionApi.Controllers;
[ApiController, Route("api/consignments"), Authorize]
public class ConsignmentsController : ControllerBase
{
    [HttpPost]
    public IActionResult Create() => StatusCode(501, new { message = "Consignments are unavailable in this portfolio demo. No items, payment or shipping are accepted." });
}
