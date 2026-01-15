// src/lib/signalr.js
import * as signalR from "@microsoft/signalr";

let connection = null;

const signalrBase =
  import.meta.env.VITE_SIGNALR_URL ??
  (import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "") + "/Hubs/AuctionHub");

/**
 * Start (or reuse) a global SignalR hub connection.
 * @param {() => string|null} getToken - returns current token
 * @param {Object} handlers - optional event handlers
 */
export async function startHub(getToken, handlers = {}) {
  if (!connection) {
    connection = new signalR.HubConnectionBuilder()
      .withUrl(signalrBase, {
        accessTokenFactory: () => getToken?.() ?? "",
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();
  }

  attachHandlers(connection, handlers);

  if (connection.state === signalR.HubConnectionState.Disconnected) {
    try {
      await connection.start();
      console.log("✅ SignalR connected");
    } catch (err) {
      console.warn("SignalR start failed:", err);
    }
  }

  return connection;
}

function attachHandlers(conn, handlers) {
  if (!conn) return;
  Object.entries(handlers).forEach(([event, handler]) => {
    conn.off(event);
    conn.on(event, handler);
  });
}

export async function stopHub() {
  if (!connection) return;
  try {
    await connection.stop();
  } finally {
    connection = null;
  }
}

export function getConnection() {
  return connection;
}
