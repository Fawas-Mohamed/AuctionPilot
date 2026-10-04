using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

[Authorize(Roles = "Admin")]
public class AdminHub : Hub { }
