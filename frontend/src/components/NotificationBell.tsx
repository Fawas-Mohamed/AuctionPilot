import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { startHub, getConnection } from "@/lib/signalr";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotificationBell({ getToken, onToggle, onClose ,open}) {
  const [notifs, setNotifs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const res = await api.get("/notifications");
        if (!mounted) return;
        setNotifs(res.data);
        setUnreadCount(res.data.filter(n => !n.isRead).length);
      } catch (err) {
        console.error("Failed to load notifications", err);
      }

      // start hub and listen for notifications
      await startHub(getToken, {
        NotificationCreated: (payload) => {
          // payload shape matches NotificationService (Id, Title, Message, IsRead, CreatedAt, AuctionId)
          setNotifs(prev => [payload, ...prev]);
          setUnreadCount(c => c + 1);
          // optional: show a toast
        },
        AuctionClosed: (payload) => {
          // optionally update auctions list (handled elsewhere)
          // console.log("auction closed", payload);
        }
      });
    }
    init();
    return () => { mounted = false; /* optionally stopHub() if you want */ };
  }, [getToken]);

  const markAsRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1)); 
    } catch (err) {
      console.error("Mark as read failed", err);
    }
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
