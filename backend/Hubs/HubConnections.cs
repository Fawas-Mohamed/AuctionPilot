using System.Collections.Concurrent;
namespace AuctionApi.Hubs;

public class HubConnections
{
    private readonly ConcurrentDictionary<string, (string UserId, Action Abort)> connections = new();
    public void Add(string connectionId, string userId, Action abort) => connections[connectionId] = (userId, abort);
    public void Remove(string connectionId) => connections.TryRemove(connectionId, out _);
    public void DisconnectUser(string userId)
    {
        foreach (var pair in connections)
            if (pair.Value.UserId == userId) { pair.Value.Abort(); connections.TryRemove(pair.Key, out _); }
    }
}
