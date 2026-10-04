using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace AuctionApi.Data;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        // Scaffolding does not connect; database commands require an explicit isolated target.
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection") ??
            "Host=127.0.0.1;Port=55439;Database=auctionpilot_demo;Username=postgres";
        return new(new DbContextOptionsBuilder<ApplicationDbContext>().UseNpgsql(connection).Options);
    }
}
