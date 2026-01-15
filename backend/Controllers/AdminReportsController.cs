using AuctionApi.Data;
using AuctionApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace AuctionApp.Controllers.Admin
{
    [ApiController]
    [Route("api/admin/reports")]
    public class AdminReportsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public AdminReportsController(ApplicationDbContext context)
        {
            _context = context;
        }

        // ✅ Today’s sales
        [HttpGet("today-sales")]
        public async Task<IActionResult> GetTodaySales()
        {
            var today = DateTime.UtcNow.Date;

            var totalSales = await _context.Orders
                .Where(o => o.CreatedAt.Date == today)
                .SumAsync(o => (decimal?)o.Amount) ?? 0;

            return Ok(new { totalSales });
        }

        // ✅ Monthly sales
        [HttpGet("monthly-sales")]
        public async Task<IActionResult> GetMonthlySales()
        {
            var now = DateTime.UtcNow;
            var totalSales = await _context.Orders
                .Where(o => o.CreatedAt.Year == now.Year && o.CreatedAt.Month == now.Month)
                .SumAsync(o => (decimal?)o.Amount) ?? 0;

            return Ok(new { totalSales });
        }

        // ✅ Lost auctions (closed without bids or reserve not met)
        [HttpGet("lost-auctions")]
        public async Task<IActionResult> GetLostAuctions()
        {
            var lostCount = await _context.Auctions
                .Where(a => a.Status == AuctionStatus.Closed &&
                           (a.Bids == null || a.Bids.Count == 0 ||
                            (a.ReservePrice != null && a.CurrentPrice < a.ReservePrice)))
                .CountAsync();

            return Ok(new { count = lostCount });
        }

        // ✅ Sales per day (graph)
        [HttpGet("sales-graph")]
        public async Task<IActionResult> GetSalesGraph()
        {
            var now = DateTime.UtcNow;

            var dailySales = await _context.Orders
                .Where(o => o.CreatedAt.Year == now.Year && o.CreatedAt.Month == now.Month)
                .GroupBy(o => o.CreatedAt.Date)
                .Select(g => new
                {
                    date = g.Key,
                    total = g.Sum(x => x.Amount)
                })
                .OrderBy(x => x.date)
                .ToListAsync();

            return Ok(dailySales);
        }
    }
}
