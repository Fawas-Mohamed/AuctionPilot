import { useEffect, useRef } from "react";
export function useServerRefresh(refresh: () => Promise<unknown>) {
    const latest = useRef(refresh);
    latest.current = refresh;
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const request = () => {
            clearTimeout(timer);
            timer = setTimeout(() => { void latest.current().catch(() => {}); }, 100);
        };
        const visible = () => { if (document.visibilityState === "visible") request(); };
        window.addEventListener("auctionpilot:resync", request);
        window.addEventListener("online", request);
        document.addEventListener("visibilitychange", visible);
        return () => {
            clearTimeout(timer);
            window.removeEventListener("auctionpilot:resync", request);
            window.removeEventListener("online", request);
            document.removeEventListener("visibilitychange", visible);
        };
    }, []);
}
