import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { HubConnectionBuilder, HubConnection } from "@microsoft/signalr";
import api from "@/lib/api";
import useCategories from "@/lib/useCategories";
import { parseServerUtcToDate } from "@/utils/formatServerUtc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, Heart } from "lucide-react";

type Auction = {
  id: number;
  title: string;
  description?: string;
  imageUrl?: string | null;
  currentPrice?: number;
  startPrice?: number;
  startTime?: string;
  endTime?: string;
  categoryId?: number | null;
  category?: { id: number; name: string } | null;
  bidCount?: number;
  isClosed?: boolean;
};

// Capitalize first letter of each word
const capitalize = (s: string) =>
  s.replace(/\b\w/g, (c) => c.toUpperCase());

const CategoryPage: React.FC = () => {
  const { category: categoryParam } = useParams<{ category?: string }>();
  const { categories, loading: catLoading } = useCategories();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<HubConnection | null>(null);

  const apiBase = (import.meta.env.VITE_API_URL ?? "https://localhost:62628").replace(/\/$/, "");
  const signalRUrl =import.meta.env.VITE_SIGNALR_URL ?? `${apiBase.replace(/\/api$|\/$/, "")}/hubs/auction`;

  // 🧭 Resolve category (by ID or slug)
  const resolvedCategory = useMemo(() => {
    if (!categoryParam || categories.length === 0) return null;
    const decoded = decodeURIComponent(categoryParam).replace(/[-_]/g, " ").toLowerCase();
    const cat = categories.find((c) => c.name.toLowerCase() === decoded);
    return cat ? { ...cat, name: cat.name } : { id: undefined, name: decoded.split(' ').map(s => s[0].toUpperCase() + s.slice(1)).join(' ') };
  }, [categoryParam, categories]);

  // 🧾 Fetch auctions for category
  const fetchAuctionsForCategory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/auctions");
      const all: Auction[] = res.data ?? [];
      const filtered = all.filter((a) => {
        if (!resolvedCategory) return false;
        if (typeof resolvedCategory.id === "number") {
          return a.categoryId === resolvedCategory.id || a.category?.id === resolvedCategory.id;
        }
        if (resolvedCategory.name) {
          return (a.category?.name ?? "").toLowerCase() === resolvedCategory.name.toLowerCase();
        }
        return false;
      });
      setAuctions(filtered);
    } catch (e: any) {
      console.error("Failed loading auctions for category", e);
      setError(e?.message ?? "Failed to load auctions");
    } finally {
      setLoading(false);
    }
  };

  // 📦 Initial load
  useEffect(() => {
    if (resolvedCategory) void fetchAuctionsForCategory();
  }, [resolvedCategory]);

  // 🔗 SignalR connection setup
  useEffect(() => {
    if (!resolvedCategory) return;

    const token = localStorage.getItem("token") ?? "";
    const conn = new HubConnectionBuilder()
      .withUrl(signalRUrl, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .build();

    setConnection(conn);

    const start = async () => {
      try {
        await conn.start();
        if (resolvedCategory && typeof resolvedCategory.id === "number") {
          conn.invoke("JoinCategoryGroup", `category-${resolvedCategory.id}`).catch(() => {});
        }
        console.debug("✅ CategoryPage SignalR connected");
      } catch (e) {
        console.warn("⚠️ SignalR start failed", e);
      }
    };

    conn.on("BidPlaced", (payload: any) => {
      const auctionId = payload.auctionId ?? payload.AuctionId ?? payload.id ?? payload.Id;
      const newPrice = payload.amount ?? payload.Amount ?? payload.currentPrice ?? payload.CurrentPrice;
      const bidCount = payload.bidCount ?? payload.BidCount;
      if (auctionId == null) return;
      setAuctions((prev) =>
        prev.map((a) =>
          a.id === Number(auctionId)
            ? { ...a, currentPrice: newPrice ?? a.currentPrice, bidCount: bidCount ?? a.bidCount }
            : a
        )
      );
    });

    conn.on("AuctionCreated", fetchAuctionsForCategory);
    conn.on("AuctionUpdated", fetchAuctionsForCategory);
    conn.on("AuctionClosed", fetchAuctionsForCategory);

    start();

    return () => {
      conn.stop().catch(() => {});
      conn.off("BidPlaced");
      conn.off("AuctionCreated");
      conn.off("AuctionUpdated");
      conn.off("AuctionClosed");
      setConnection(null);
    };
  }, [resolvedCategory]);

  // ⏰ Countdown Timer (updates every second)
  const TimeRemaining: React.FC<{ end?: string | null }> = ({ end }) => {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
      const interval = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(interval);
    }, []);
    if (!end) return <span>—</span>;
    let dt: Date | null = null;
    try {
      dt = new Date(end); // Direct Date parse works if ISO string
    } catch {
      dt = parseServerUtcToDate(end); // fallback
    }

    if (!dt || isNaN(dt.getTime())) return <span>—</span>;
    const diff = dt.getTime() - now;
    if (diff <= 0) return <span>Ended</span>;

    const totalMin = Math.floor(diff / 1000 / 60);
    const days = Math.floor(totalMin / (60 * 24));
    const hours = Math.floor((totalMin % (60 * 24)) / 60);
    const mins = totalMin % 60;

    if (days > 0) return <span>{days}d {hours}h {mins}m</span>;
    if (hours > 0) return <span>{hours}h {mins}m</span>;
    return <span>{mins}m</span>;
  };

  const heading = resolvedCategory?.name ?? categoryParam ?? "Category";

  if (loading || catLoading) return <div className="container p-6">Loading...</div>;
  if (error) return <div className="container p-6 text-red-600">Error: {error}</div>;

  return (
    <div className="container p-6">
      <h1 className="text-2xl font-bold mb-6">Category: {heading}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {auctions.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground p-8 rounded bg-white shadow-sm">
            No auctions found in this category.
          </div>
        )}

        {auctions.map((a) => {
          const endDate = a.endTime ? parseServerUtcToDate(a.endTime) : null;
          const isEnded = !endDate || endDate.getTime() <= Date.now();
          const imageUrl = a.imageUrl
            ? a.imageUrl.startsWith("http") ? a.imageUrl : `${apiBase}${a.imageUrl}`
            : null;
          const currentPrice = a.currentPrice ?? a.startPrice ?? 0;

          return (
            <Card key={a.id} className="group auction-gradient-card hover:auction-shadow-elegant auction-transition cursor-pointer overflow-hidden">
              <div className="relative">
                {imageUrl ? (
                  <img src={a.imageUrl.startsWith("http") ? a.imageUrl : `https://localhost:62628${a.imageUrl}`} alt={a.title} className="w-full h-64 object-cover group-hover:scale-105 auction-transition" />
                ) : (
                  <div className="w-full h-64 flex items-center justify-center bg-slate-100 text-muted-foreground">No image</div>
                )}
                <Badge className={`absolute top-3 left-3 ${isEnded ? "bg-gray-300 text-gray-700" : "bg-red-500 text-white animate-pulse"}`}>
                  {isEnded ? "Ended" : "LIVE"}
                </Badge>
                <Button variant="ghost" size="icon" className="absolute top-3 right-3 bg-black/20 hover:bg-black/40">
                  <Heart className="h-5 w-5"/>
                </Button>
              </div>

              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-auction-navy group-hover:text-auction-gold auction-transition line-clamp-1">
                      {a.title}
                    </h3>
                    <p className="text-muted-foreground text-sm mt-1 line-clamp-2">{a.description}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Current Bid</span>
                      <span className="text-xl font-bold text-auction-gold">${currentPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Starting: ${Number(a.startPrice ?? 0).toLocaleString()}</span>
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4"/>
                        <span>{a.bidCount ?? 0} bids</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4"/>
                      <TimeRemaining end={a.endTime}/>
                    </div>
                    <Link to={`/auctions/${a.id}`}>
                      <Button variant="bid" size="sm" disabled={isEnded}>Place Bid</Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryPage;
