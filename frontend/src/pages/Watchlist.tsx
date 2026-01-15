// src/pages/Watchlist.tsx
import React, { useEffect, useRef, useState } from "react";
import { Heart, Clock, Eye, Trash2, Plus } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";
import * as signalR from "@microsoft/signalr";

type Auction = {
  id: number;
  title: string;
  imageUrl?: string | null;
  currentPrice: number;
  startPrice?: number;
  endTime?: string;
  totalBids?: number;
  views?: number;
};

type WatchlistItem = {
  id: number;
  auctionId: number;
  auction: Auction;
  // keep compatibility with whatever your API returns
  addedDate?: string | null;
};

const buildImageUrl = (img?: string | null) => {
  if (!img) return undefined;
  if (/^https?:\/\//i.test(img)) return img; // absolute
  if (/^\/\//.test(img)) return `${window.location.protocol}${img}`; // protocol-relative
  const apiBaseRaw = (import.meta.env as any).VITE_API_URL ?? "";
  const apiBase = apiBaseRaw.replace(/\/api\/?$/, "").replace(/\/$/, "");
  if (img.startsWith("/")) {
    const base = apiBase || window.location.origin;
    return `${base}${img}`;
  }
  // fallback: assume uploads folder on server
  const base = apiBase || window.location.origin;
  return `${base}/uploads/${img}`;
};

const formatTimeRemaining = (endTime?: string) => {
  if (!endTime) return "—";
  const end = new Date(endTime);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
};

const Watchlist: React.FC = () => {
  const [watchedItems, setWatchedItems] = useState<WatchlistItem[]>([]);
  const hubRef = useRef<signalR.HubConnection | null>(null);

  const fetchWatchlist = async () => {
    try {
      const res = await api.get("/watchlist");
      // Expecting array of { id, auctionId, auction: { ... } } per server implementation
      setWatchedItems(res.data ?? []);
    } catch (err) {
      console.error("Error fetching watchlist", err);
    }
  };

  useEffect(() => {
    void fetchWatchlist();

    // Setup SignalR connection
    const token = localStorage.getItem("token") ?? undefined;
    const envSignalR = (import.meta.env as any).VITE_SIGNALR_URL as string | undefined;
    const apiUrl = (import.meta.env as any).VITE_API_URL as string | undefined;
    const fallback = apiUrl ? `${apiUrl.replace(/\/api\/?$/, "").replace(/\/$/, "")}/hubs/auction` : `${window.location.origin}/hubs/auction`;
    const hubUrl = envSignalR ?? fallback;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, { accessTokenFactory: () => (token ? token : undefined) })
      .withAutomaticReconnect()
      .build();

    hubRef.current = connection;

    connection
      .start()
      .then(() => {
        console.info("Watchlist SignalR connected");
        // Listen for watchlist changes for this user
        connection.on("WatchlistChanged", (auctionId: number, added: boolean) => {
          if (added) {
            // fetch details for new auction and update list (simple approach)
            // Option A: re-fetch all items
            void fetchWatchlist();
            // Option B: fetch specific auction and append — the above is simpler and keeps data consistent
          } else {
            // remove locally
            setWatchedItems((prev) => prev.filter((i) => i.auctionId !== auctionId));
          }
        });
      })
      .catch((err) => {
        console.warn("SignalR (watchlist) start failed:", err);
      });

    return () => {
      if (hubRef.current) {
        try {
          hubRef.current.off("WatchlistChanged");
          hubRef.current.stop().catch(() => {});
        } catch {}
        hubRef.current = null;
      }
    };
  }, []);

  const removeFromWatchlist = async (auctionId: number) => {
    try {
      await api.delete(`/watchlist/${auctionId}`);
      setWatchedItems((items) => items.filter((item) => item.auctionId !== auctionId));
    } catch (err) {
      console.error("Error removing watchlist item", err);
    }
  };

  const totalValue = watchedItems.reduce((sum, item) => sum + (item.auction?.currentPrice ?? 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold auction-gradient-text">My Watchlist</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Keep track of items you're interested in and never miss an opportunity
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="auction-shadow-elegant">
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-auction-premium mb-2">
                  {watchedItems.length}
                </div>
                <div className="text-sm text-muted-foreground">Items Watched</div>
              </CardContent>
            </Card>
            <Card className="auction-shadow-elegant">
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-auction-navy mb-2">
                  {totalValue.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Total Value</div>
              </CardContent>
            </Card>
            <Card className="auction-shadow-elegant">
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-auction-gold mb-2">
                  {watchedItems.filter(item => formatTimeRemaining(item.auction.endTime) !== "Ended").length}
                </div>
                <div className="text-sm text-muted-foreground">Active Auctions</div>
              </CardContent>
            </Card>
          </div>

          {/* Watchlist Items */}
          {watchedItems.length > 0 ? (
            <div className="grid gap-6">
              {watchedItems.map((item) => {
                const imgSrc = buildImageUrl(item.auction?.imageUrl) || "/fallback.jpg";
                return (
                  <Card key={item.id} className="auction-shadow-elegant hover:scale-[1.02] auction-transition">
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row gap-6">
                        <div className="w-full lg:w-48 h-32 lg:h-auto">
                          <img
                            src={imgSrc}
                            alt={item.auction?.title ?? "Auction image"}
                            className="w-full h-full object-cover rounded-lg"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/fallback.jpg"; }}
                          />
                        </div>

                        <div className="flex-1 space-y-4">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div>
                              <h3 className="text-xl font-bold text-auction-navy mb-2">{item.auction?.title}</h3>
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline">{/* could show category */}Auction</Badge>
                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  {item.auction?.views ?? "—"} views
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Added {item.addedDate ? new Date(item.addedDate).toLocaleDateString() : "—"}
                              </p>
                            </div>

                            <div className="text-right">
                              <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                Time Remaining
                              </div>
                              <div className="text-lg font-bold text-auction-premium">
                                {formatTimeRemaining(item.auction?.endTime)}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <div className="text-sm text-muted-foreground">Current Bid</div>
                              <div className="text-xl font-bold text-auction-navy">
                                { (item.auction?.currentPrice ?? 0).toLocaleString() }
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">Starting Price</div>
                              <div className="text-xl font-bold">
                                { (item.auction?.startPrice ?? 0).toLocaleString() }
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">Auction ID</div>
                              <div className="text-xl font-bold text-auction-premium">
                                {item.auctionId}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-3">
                            <Button variant="premium" className="flex-1">
                              <Plus className="w-4 h-4 mr-2" />
                              Place Bid
                            </Button>
                            <Button variant="outline" className="flex-1" onClick={() => {
                              // navigate to auction details page or implement client-side modal
                              window.location.href = `/auctions/${item.auctionId}`;
                            }}>
                              View Details
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => removeFromWatchlist(item.auctionId)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="auction-shadow-elegant">
              <CardContent className="p-12 text-center">
                <Heart className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-bold text-auction-navy mb-2">Your Watchlist is Empty</h3>
                <p className="text-muted-foreground mb-6">
                  Start adding items to your watchlist to keep track of auctions you're interested in
                </p>
                <Button variant="premium" onClick={() => { window.location.href = "/auctions"; }}>
                  Browse Auctions
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default Watchlist;
