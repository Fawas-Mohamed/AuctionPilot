import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { startHub, subscribeHub } from "@/lib/signalr";
import { useServerRefresh } from "@/hooks/useServerRefresh";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
type NotificationRow = { id: number; title: string; message?: string; isRead: boolean; auctionId?: number };
type Props = { getToken?: () => string | null; onToggle: () => void; onClose?: () => void; open: boolean };
export default function NotificationBell({ onToggle, open }: Props) {
  const [notifs, setNotifs] = useState<NotificationRow[]>([]);
  const token = localStorage.getItem("token");
  const refresh = async () => {
    if (!localStorage.getItem("token")) return;
    const response = await api.get("/notifications");
    setNotifs(response.data);
  };
  useServerRefresh(refresh);
  useEffect(() => {
    let mounted = true;
    if (!token) { setNotifs([]); return; }
    const unsubscribe = subscribeHub({
      NotificationCreated: (payload: NotificationRow) => {
        if (mounted) setNotifs(previous => [payload, ...previous.filter(n => n.id !== payload.id)]);
      }
    });
    void api.get("/notifications").then(response => { if (mounted) setNotifs(response.data); }).catch(() => {});
    void startHub().catch(() => {});
    return () => { mounted = false; unsubscribe(); };
  }, [token]);
  const markAsRead = async (id: number) => {
    try {
      await api.post("/notifications/" + id + "/read");
      setNotifs(previous => previous.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch { }
  };

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" asChild>
        <button onClick={onToggle}>
          <Bell className="h-5 w-5 text-gray-700" />
          {notifs.some(n => !n.isRead) && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
          )}
        </button>
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto
          rounded-xl bg-white shadow-xl border z-50">
          <div className="px-4 py-3 font-semibold border-b">
          Notifications
          </div>
          {notifs.length === 0 && (
            <div className="p-4 text-sm text-gray-500 text-center">
              No notifications
            </div>
          )}

          {notifs.map(n => (
            <div
              key={n.id}
              className={`px-4 py-3 border-b last:border-b-0
                ${n.isRead ? "bg-white" : "bg-blue-50"}`}
            >
          <div className={`text-sm ${n.isRead ? "font-medium" : "font-semibold"}`}>
            {n.title}
          </div>

          <div className="text-xs text-gray-600 mt-1">
            {n.message}
          </div>

          <div className="mt-3 flex gap-3 text-xs">
            {!n.isRead && (
              <button
                onClick={() => markAsRead(n.id)}
                className="text-blue-600 hover:underline"
              >
                Mark as read
              </button>
            )}

          {n.auctionId && (
            <a
              href={`/auctions/${n.auctionId}`}
              className="text-gray-600 hover:text-black hover:underline"
            >
              View auction
            </a>
          )}
        </div>
      </div>
    ))}
  </div>
)}

</div>



    
    /*<div style={{ position: "relative" }}>
      <button   onClick={() => setOpen(o => !o)}>
           
                <button aria-label="Notifications" >
                  <Bell className="h-5 w-5 " />
                </button>
    
      </button>

      {open && (
        <div style={{
          position: "absolute",
          right: 0,
          width: 320,
          maxHeight: 400,
          overflowY: "auto",
          border: "1px solid #ddd",
          background: "#e8e2e2ff",
          zIndex: 50,
          padding: 8
        }}>
          {notifs.length === 0 && <div>No notifications</div>}
          {notifs.map(n => (
            <div key={n.id} style={{ padding: 8, borderBottom: "1px solid #eee", background: n.isRead ? "white" : "#f9f9ff" }}>
              <div style={{ fontWeight: n.isRead ? 400 : 700 }}>{n.title}</div>
              <div style={{ fontSize: 13, color: "#333" }}>{n.message}</div>
              <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
                {!n.isRead && <button onClick={() => markAsRead(n.id)}>Mark read</button>}
                {n.auctionId && <a href={`/auctions/${n.auctionId}`}>View auction</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>*/
  );
}
