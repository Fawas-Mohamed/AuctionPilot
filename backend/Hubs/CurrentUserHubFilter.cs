using AuctionApi.Services;
using Microsoft.AspNetCore.SignalR;
namespace AuctionApi.Hubs;

public class CurrentUserHubFilter(IServiceScopeFactory scopes, HubConnections connections) : IHubFilter
{
    public async ValueTask<object?> InvokeMethodAsync(HubInvocationContext context,
        Func<HubInvocationContext, ValueTask<object?>> next)
    {
        using var scope = scopes.CreateScope();
        if (!await scope.ServiceProvider.GetRequiredService<TokenUserValidator>().IsValidAsync(context.Context.User))
        {
            context.Context.Abort();
            throw new HubException("Please sign in again.");
        }
        return await next(context);
    }
    public async Task OnConnectedAsync(HubLifetimeContext context, Func<HubLifetimeContext, Task> next)
    {
        using var scope = scopes.CreateScope();
        if (!await scope.ServiceProvider.GetRequiredService<TokenUserValidator>().IsValidAsync(context.Context.User))
        { context.Context.Abort(); return; }
        connections.Add(context.Context.ConnectionId, context.Context.UserIdentifier!, context.Context.Abort);
        await next(context);
    }
    public async Task OnDisconnectedAsync(HubLifetimeContext context, Exception? exception, Func<HubLifetimeContext, Exception?, Task> next)
    {
        connections.Remove(context.Context.ConnectionId);
        await next(context, exception);
    }
}
