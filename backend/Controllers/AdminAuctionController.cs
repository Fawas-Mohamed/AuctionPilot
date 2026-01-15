using AuctionApi.Data;
using AuctionApi.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AuctionApi.Controllers
{
    [ApiController]
    [Route("api/admin/auctions")]
    [Authorize(Roles = "Admin")] // only admins
    public class AdminAuctionsController : ControllerBase
    {

        private readonly ApplicationDbContext _db;

        public AdminAuctionsController(ApplicationDbContext db)
        {
            _db = db;
        }

        // GET: api/admin/auctions
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var auctions = await _db.Auctions.ToListAsync();
            return Ok(auctions);
        }

        // GET: api/admin/auctions/5
        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            var auction = await _db.Auctions
                .Include(a => a.Category)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (auction == null) return NotFound();
            return Ok(auction);
        }

        // POST: api/admin/auctions
      

        // PUT: api/admin/auctions/5
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Auction updated)
        {
            var auction = await _db.Auctions.FindAsync(id);
            if (auction == null) return NotFound();

            auction.Title = updated.Title;
            auction.Description = updated.Description;
            auction.StartPrice = updated.StartPrice;
            auction.StartTime = updated.StartTime;
            auction.EndTime = updated.EndTime;
            auction.ImageUrl = updated.ImageUrl;

            await _db.SaveChangesAsync();
            return Ok(auction);
        }

        // DELETE: api/admin/auctions/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var auction = await _db.Auctions.FindAsync(id);
            if (auction == null) return NotFound();

            _db.Auctions.Remove(auction);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // PATCH: api/admin/auctions/5/close
        [HttpPatch("{id:int}/close")]
        public async Task<IActionResult> Close(int id)
        {
            var auction = await _db.Auctions.FindAsync(id);
            if (auction == null) return NotFound();

            auction.Status = AuctionStatus.Closed;
            auction.IsClosed = true;
            await _db.SaveChangesAsync();

            return Ok(auction);
        }

    }

  
}
