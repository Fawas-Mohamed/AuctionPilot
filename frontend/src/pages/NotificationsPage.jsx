// src/pages/NotificationsPage.jsx
import React, { useEffect, useState } from "react";
import api from "@/lib/api";

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/notifications");
        setNotifs(res.data);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  const markAllRead = async () => {
    try {
      // naive: call mark read for each unread
      const unread = notifs.filter(n => !n.isRead);
      await Promise.all(unread.map(n => api.post(`/notifications/${n.id}/read`)));
      setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <h1>Notifications</h1>
      <button onClick={markAllRead}>Mark all read</button>
      <div style={{ marginTop: 12 }}>
        {notifs.length === 0 && <div>No notifications yet.</div>}
        {notifs.map(n => (
          <div key={n.id} style={{ borderBottom: "1px solid #eee", padding: 12 }}>
            <div style={{ fontWeight: n.isRead ? 400 : 700 }}>{n.title}</div>
            <div style={{ color: "#555" }}>{n.message}</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>{new Date(n.createdAt).toLocaleString()}</div>
            {n.auctionId && <div><a href={`/auctions/${n.auctionId}`}>View auction</a></div>}
          </div>
        ))}
      </div>
    </div>
  );
}
