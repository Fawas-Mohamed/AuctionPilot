using AuctionApi.Data;
using AuctionApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AuctionApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CategoriesController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        public CategoriesController(ApplicationDbContext db) => _db = db;

        [HttpGet]
        public IActionResult GetCategories()
        {
            var categories = _db.Categories.ToList();
            return Ok(categories);
        }
    }
}
