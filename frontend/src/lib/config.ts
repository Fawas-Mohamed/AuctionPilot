const configuredApi = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, "");
if (!configuredApi && import.meta.env.PROD) throw new Error("Set VITE_API_URL before building the frontend.");
export const API_URL = configuredApi || "http://localhost:62628/api";
export const BACKEND_ORIGIN = API_URL.replace(/\/api$/i, "");
export const SIGNALR_URL = import.meta.env.VITE_SIGNALR_URL?.trim() || BACKEND_ORIGIN + "/hubs/auction";
if (!API_URL.endsWith("/api") || new URL(SIGNALR_URL).origin !== new URL(API_URL).origin ||
    !SIGNALR_URL.endsWith("/hubs/auction")) throw new Error("API and SignalR must use the same backend origin and documented paths.");
if (import.meta.env.PROD && (new URL(API_URL).protocol !== "https:" || new URL(SIGNALR_URL).protocol !== "https:"))
    throw new Error("Production API and SignalR URLs must use HTTPS.");

export function imageUrl(value?: string | null): string | undefined {
    if (!value) return undefined;
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("//")) return "https:" + value;
    return BACKEND_ORIGIN + (value.startsWith("/") ? value : "/uploads/" + value);
}
