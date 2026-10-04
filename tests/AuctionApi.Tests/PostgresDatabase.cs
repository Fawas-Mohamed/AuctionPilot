using AuctionApi.Data;
using AuctionApi.Hubs;
using AuctionApi.Models;
using AuctionApi.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Xunit;
namespace AuctionApi.Tests;

// PostgreSQL tests must fail without their required database, never silently skip.
public class PostgresFactAttribute : FactAttribute { }

public class PostgresDatabase : IAsyncLifetime
{
    public string ConnectionString { get; private set; } = "";
    private string? baseConnection;
    private readonly string schema = "ap_test_" + Guid.NewGuid().ToString("N");
    public MutableClock Clock { get; } = new();
    public EventRecorder Recorder { get; } = new();
    public async Task InitializeAsync()
    {
        baseConnection = Environment.GetEnvironmentVariable("AUCTIONPILOT_TEST_CONNECTION");
        if (string.IsNullOrWhiteSpace(baseConnection)) throw new InvalidOperationException("Set AUCTIONPILOT_TEST_CONNECTION to an isolated PostgreSQL database before running integration tests.");
        await using var connection = new NpgsqlConnection(baseConnection);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand($"""CREATE SCHEMA "{schema}" """, connection);
        await command.ExecuteNonQueryAsync();
        var settings = new NpgsqlConnectionStringBuilder(baseConnection) { SearchPath = schema, MaxPoolSize = 20 };
        ConnectionString = settings.ConnectionString;
        await using var db = NewContext();
        await db.Database.MigrateAsync();
        db.Users.AddRange(new[] { "seller", "bidder-a", "bidder-b" }.Select(id =>
            new ApplicationUser { Id = id, DisplayName = id, UserName = id, SecurityStamp = Guid.NewGuid().ToString() }));
        await db.SaveChangesAsync();
    }
    public ApplicationDbContext NewContext(params IInterceptor[] interceptors) =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(ConnectionString, o => o.MigrationsHistoryTable("__EFMigrationsHistory", schema))
            .AddInterceptors(interceptors).Options);
    public AuctionEvents Events() => new(Recorder, NullLogger<AuctionEvents>.Instance);
    public async Task<int> AuctionAsync(decimal? reserve = null, DateTimeOffset? start = null, DateTimeOffset? end = null)
    {
        await using var db = NewContext();
        var auction = new Auction { Title = "Synthetic auction", StartPrice = 10, CurrentPrice = 10,
            SellerId = "seller", CreatedById = "seller", ReservePrice = reserve,
            StartTime = start ?? Clock.GetUtcNow().AddMinutes(-1), EndTime = end ?? Clock.GetUtcNow().AddHours(1) };
        db.Auctions.Add(auction); await db.SaveChangesAsync(); return auction.Id;
    }
    public async Task<BidResult> BidAsync(int id, string bidder, decimal amount, Guid? request = null)
    {
        await using var db = NewContext();
        return await new BidService(db, Events(), Clock).PlaceAsync(id, bidder, amount, request ?? Guid.NewGuid());
    }
    public async Task<ClosureResult> CloseAsync(int id, bool force = true)
    {
        await using var db = NewContext();
        return await new AuctionResolver(db, Events(), Clock).ResolveAsync(id, force);
    }
    public virtual async Task DisposeAsync()
    {
        if (string.IsNullOrWhiteSpace(baseConnection)) return;
        NpgsqlConnection.ClearAllPools();
        await using var connection = new NpgsqlConnection(baseConnection); await connection.OpenAsync();
        // Only this fixture's randomly generated schema is cleaned up. No database is dropped/reset.
        if (!schema.StartsWith("ap_test_") || schema.Length != 40) throw new InvalidOperationException("Unsafe test schema.");
        await using var command = new NpgsqlCommand($"""DROP SCHEMA "{schema}" CASCADE""", connection);
        await command.ExecuteNonQueryAsync();
    }
}
public class MutableClock : TimeProvider
{
    private long ticks = DateTimeOffset.UtcNow.UtcTicks;
    public override DateTimeOffset GetUtcNow() => new(Interlocked.Read(ref ticks), TimeSpan.Zero);
    public void Set(DateTimeOffset value) => Interlocked.Exchange(ref ticks, value.UtcTicks);
}

public class EventRecorder : IHubContext<AuctionHub>, IHubClients, IClientProxy, IGroupManager
{
    public System.Collections.Concurrent.ConcurrentQueue<string> Events { get; } = new();
    public Func<string, Task>? Observer { get; set; }
    IHubClients IHubContext<AuctionHub>.Clients => this; IGroupManager IHubContext<AuctionHub>.Groups => this; public IClientProxy All => this;
    public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds) => this;
    public IClientProxy Client(string connectionId) => this;
    public IClientProxy Clients(IReadOnlyList<string> connectionIds) => this;
    public IClientProxy Group(string groupName) => this;
    public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) => this;
    public IClientProxy Groups(IReadOnlyList<string> groupNames) => this;
    public IClientProxy User(string userId) => this;
    public IClientProxy Users(IReadOnlyList<string> userIds) => this;
    public async Task SendCoreAsync(string method, object?[] args, CancellationToken cancellationToken = default)
    { Events.Enqueue(method); if (Observer != null) await Observer(method); }
    public Task AddToGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default) => Task.CompletedTask;
    public Task RemoveFromGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default) => Task.CompletedTask;
}
