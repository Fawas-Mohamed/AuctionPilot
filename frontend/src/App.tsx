// src/App.tsx
import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { startHub } from "@/lib/signalr";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import NotificationBell from "@/components/NotificationBell";

const App: React.FC = () => {
  const token = localStorage.getItem("token");

  // 🔔 Start SignalR connection when user is logged in
  useEffect(() => {
    if (!token) return;

    startHub(() => token, {
      NotificationCreated: (payload: any) => {
        console.log("🔔 Notification received:", payload);
      },
      AuctionClosed: (payload: any) => {
        console.log("🏁 Auction closed:", payload);
      },
    });
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ✅ Header section with Notification Bell */}
      <Header/>

      {/* ✅ Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* ✅ Footer section */}
      <Footer />
    </div>
  );
};

export default App;
