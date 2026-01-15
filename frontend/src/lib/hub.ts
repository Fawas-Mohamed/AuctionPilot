// src/lib/hub.ts
import { HubConnectionBuilder } from "@microsoft/signalr";

let connection: any = null;

export async function startHub() {
  if (connection) return connection;
  const tokenFactory = () => localStorage.getItem("token") ?? "";
  const base = (import.meta.env.VITE_API_URL ?? "https://localhost:62628").replace(/\/$/, "");
  const url = `${base.replace(/\/api$|\/$/, "")}/hubs/auction`;

  connection = new HubConnectionBuilder()
    .withUrl(url, { accessTokenFactory: tokenFactory })
    .withAutomaticReconnect()
    .build();

  await connection.start();

  // auto-join user group
  const myId = localStorage.getItem("userId");
  if (myId) {
    // invoke server method so server Group.AddToGroup is called (if used)
    connection.invoke("JoinUserGroup", `user-${myId}`).catch(() => {});
    // also join per-auction groups later (when you have auctions list), see below
  }

  // global AuctionClosed handler that writes into localStorage (so profile page can read)
  connection.on("AuctionClosed", (payload) => {
    try {
      console.log("SignalR AuctionClosed:", payload);
      // Save to localStorage notifications array
      const existing = JSON.parse(localStorage.getItem("notifications") || "[]");
      existing.push({
        type: "auction_win",
        auctionId: payload?.auctionId,
        orderId: payload?.orderId,
        amount: payload?.amount,
        createdAt: new Date().toISOString(),
        read: false
      });
      localStorage.setItem("notifications", JSON.stringify(existing));
    } catch (e) {
      console.error("Failed to persist AuctionClosed", e);
    }
  });

  return connection;
}

export function getHub() {
  return connection;
}
