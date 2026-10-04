import { useServerRefresh } from "@/hooks/useServerRefresh";
import { API_URL, SIGNALR_URL, BACKEND_ORIGIN, imageUrl } from "@/lib/config";
import { createAuctionConnection } from "@/lib/signalr";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import * as signalR from "@microsoft/signalr";

const AuctionsList = () => {
  const [auctions, setAuctions] = useState<any[]>([]);

  useServerRefresh(async () => { const r = await api.get("/auctions"); setAuctions(r.data ?? []); });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await api.get("/auctions");
        if (!mounted) return;
        setAuctions(res.data);
      } catch (err) {
        console.error("Failed to load auctions", err);
      }
    };
    void load();

    // SignalR setup - update url if different
    const hubUrl = SIGNALR_URL;
    const connection = createAuctionConnection();

    connection.on("AuctionCreated", (newAuction: any) => {
      // prepend new auction
      setAuctions(prev => [newAuction, ...prev]);
    });

    connection.start()
      .then(() => console.log("Connected to auction hub"))
      .catch(e => console.warn("SignalR start failed:", e));

    return () => {
      mounted = false;
      connection.stop().catch(()=>{});
    };
  }, []);
    const getImageUrl = imageUrl;

  return (
    <div>
      {auctions.map(a => (
        <div key={a.id} className="auction-row">
          <h3>{a.title}</h3>
          <img
            src={getImageUrl(a.imageUrl)}
            alt={a.title}
            width={200}
          />

          <div>Current: ${a.currentPrice}</div>
        </div>
      ))}
    </div>
  );
};

export default AuctionsList;
