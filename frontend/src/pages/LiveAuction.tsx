import { useServerRefresh } from "@/hooks/useServerRefresh";
import { createAuctionConnection } from "@/lib/signalr";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/api";
import { submitBid } from "@/lib/bidding";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HubConnectionBuilder } from "@microsoft/signalr";

const LiveAuction = () => {
  const { id } = useParams<{ id: string }>();
  const [auction, setAuction] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  useServerRefresh(async () => { if (id) { const r = await api.get("/auctions/" + id); setAuction(r.data); } });

  useEffect(() => {
    if (!id) return;

    const fetchAuction = async () => {
      try {
        const res = await api.get(`/auctions/${id}`);
        setAuction(res.data);
      } catch (err: any) {
        console.error("Failed to load auction:", err);
        setError("Failed to load auction.");
      }
    };

    fetchAuction();
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const token = localStorage.getItem("token");
    const connection = createAuctionConnection();

    connection.start().then(() => {
      void connection.invoke("JoinAuctionRoom", id).catch(() => {});
    }).catch(() => {});

  connection.on("BidPlaced", (data) => {
    // data: { auctionId, amount, bidderId, time }
    if (String(data.auctionId) === String(id)) {
      setAuction((prev: any) => prev ? {
        ...prev,
        currentPrice: data.amount,
        bidCount: data.bidCount ?? prev.bidCount
      } : prev);
    }
  });
    return () => {
      connection.stop();
    };
  }, [id]);

  const placeBid = async () => {
    if (!id || !auction || submitting) return;
    setSubmitting(true);
    try {
      const res = await submitBid(id, Number(bidAmount) || Number(auction.currentPrice) + 1);
      setBidAmount("");
      // optimistic update
      setAuction((prev: any) =>
        prev
          ? {
              ...prev,
              currentPrice: res.data.currentPrice,
              bidCount: res.data.bidCount,
            }
          : prev
      );
    } catch (err: any) {
      console.error("Bid failed:", err);
      setError(err.response?.data?.message || "Failed to place bid.");
    } finally { setSubmitting(false); }
  };

  if (!auction) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto p-6">{error || "Loading..."}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent>
            <h1 className="text-2xl font-bold">{auction.title}</h1>
            <p className="text-muted-foreground">{auction.description}</p>

            <div className="mt-4">
              <div className="text-lg">Current Price: ${auction.currentPrice}</div>
              <div className="text-sm text-muted-foreground">
                Bids: {auction.bidCount}
              </div>

              <div className="mt-4 flex gap-2">
                <Input
                  type="number"
                  placeholder="Enter your bid"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                />
                <Button onClick={placeBid} disabled={submitting}>Place Bid</Button>
              </div>
              {error && <div className="mt-2 text-red-600">{error}</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LiveAuction;
