import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { Link } from "react-router-dom";

const Auctions: React.FC = () => {
  const [auctions, setAuctions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchAll = async () => {
      try {
        const res = await api.get("/auctions");
        if (mounted) setAuctions(res.data);
      } catch (err) {
        console.error("Failed to load auctions", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchAll();

    // SignalR listen for new auctions
    const token = localStorage.getItem("token");
    const connection = new HubConnectionBuilder()
      .withUrl(`${(import.meta.env.VITE_API_URL || "https://localhost:62628")}/hubs/auction`, {
        accessTokenFactory: () => token ?? ""
      })
      .configureLogging(LogLevel.Information)
      .build();

    connection.start().catch((e) => console.error("hub start failed", e));
    connection.on("AuctionCreated", (payload: any) => {
      // optionally push newest on top
      setAuctions(prev => [payload, ...prev]);
    });

    return () => {
      mounted = false;
      connection.stop().catch(()=>{});
    };
  }, []);

  if (loading) return <div className="container p-6">Loading auctions...</div>;

  return (
    <div className="container p-6">
      <h1 className="text-2xl font-bold mb-4">Auctions</h1>
      <div className="grid grid-cols-3 gap-4">
        {auctions.map(a => (
          <Link key={a.id} to={`/auctions/${a.id}`} className="card p-4">
            <img src={a.imageUrl || "/placeholder.svg"} alt={a.title} className="w-full h-40 object-cover mb-2" />
            <h3 className="font-semibold">{a.title}</h3>
            <div>${a.currentPrice?.toLocaleString?.() ?? a.currentPrice}</div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Auctions;
