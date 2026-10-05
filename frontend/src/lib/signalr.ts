import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";
import { SIGNALR_URL } from "./config";
type Handlers = Record<string, (...args: any[]) => void>;
let shared: HubConnection | null = null;
let starting: Promise<void> | null = null;
let lastRefresh = 0;
const active = new Set<HubConnection>();
function refreshViews() {
    if (Date.now() - lastRefresh < 250) return;
    lastRefresh = Date.now();
    window.dispatchEvent(new Event("auctionpilot:resync"));
}
export function createAuctionConnection(): HubConnection {
    const connection = new HubConnectionBuilder()
        .withUrl(SIGNALR_URL, { accessTokenFactory: () => localStorage.getItem("token") || "" })
        .withAutomaticReconnect([0, 5000, 15000, 30000])
        .configureLogging(LogLevel.Warning).build();
    const rooms = new Set<string>();
    const originalInvoke = connection.invoke.bind(connection);
    connection.invoke = async <T = any>(method: string, ...args: any[]): Promise<T> => {
        const result = await originalInvoke(method, ...args) as T;
        if (method === "JoinAuctionRoom") rooms.add(String(args[0]));
        if (method === "LeaveAuctionRoom") rooms.delete(String(args[0]));
        return result;
    };
    connection.onreconnected(async () => {
        for (const room of rooms) {
            try { await originalInvoke("JoinAuctionRoom", room); } catch { }
        }
        refreshViews();
    });
    const originalStart = connection.start.bind(connection);
    const originalStop = connection.stop.bind(connection);
    const cancellation = new AbortController();
    let initialStart: Promise<void> | null = null;
    connection.start = () => {
        if (initialStart) return initialStart;
        initialStart = (async () => {
            if (!localStorage.getItem("token")) throw new Error("Sign in for realtime updates.");
            for (const delay of [0, 5000, 15000]) {
                if (cancellation.signal.aborted) return;
                if (delay) await new Promise<void>(resolve => {
                    const timer = setTimeout(done, delay);
                    function done() { clearTimeout(timer); cancellation.signal.removeEventListener("abort", done); resolve(); }
                    cancellation.signal.addEventListener("abort", done, { once: true });
                });
                if (cancellation.signal.aborted) return;
                try { await originalStart(); refreshViews(); return; }
                catch (error) {
                    if (cancellation.signal.aborted) return;
                    if (String(error).includes("401") || delay === 15000) throw error;
                }
            }
        })().finally(() => { initialStart = null; });
        return initialStart;
    };
    connection.stop = async () => {
        cancellation.abort();
        active.delete(connection);
        await originalStop();
    };
    active.add(connection);
    return connection;
}
export async function startHub(_getToken?: () => string | null, handlers: Handlers = {}) {
    if (!shared) shared = createAuctionConnection();
    Object.entries(handlers).forEach(([name, handler]) => shared!.on(name, handler));
    if (shared.state === HubConnectionState.Disconnected && !starting)
        starting = shared.start().finally(() => { starting = null; });
    if (starting) await starting;
    return shared;
}
export function subscribeHub(handlers: Handlers) {
    if (!shared) shared = createAuctionConnection();
    const connection = shared;
    Object.entries(handlers).forEach(([name, handler]) => connection.on(name, handler));
    return () => Object.entries(handlers).forEach(([name, handler]) => connection.off(name, handler));
}
export async function stopHub() {
    const connections = [...active];
    shared = null;
    starting = null;
    await Promise.allSettled(connections.map(connection => connection.stop()));
}
export const getConnection = () => shared;
window.addEventListener("auctionpilot:unauthorized", () => { void stopHub(); });
