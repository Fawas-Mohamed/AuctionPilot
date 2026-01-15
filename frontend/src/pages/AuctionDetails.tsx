// src/pages/AuctionDetails.tsx
import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, Share2, Clock, Users, Gavel, TrendingUp } from "lucide-react";
import api from "@/lib/api";
import { HubConnectionBuilder, HubConnection, LogLevel } from "@microsoft/signalr";
import { formatServerUtc, parseServerUtcToDate } from "@/utils/formatServerUtc";

type CategoryObj = { id?: number | string; name?: string; description?: string };

type AuctionDto = {
  id: number;
  title: string;
  description?: string;
  imageUrl?: string | null;
  startPrice?: number;
  currentPrice?: number;
  startTime?: string;
  endTime?: string;
  createdById?: string | null;
  status?: number | string;
  bidCount?: number;
  category?: string | CategoryObj | null;
  estimate?: string | null;
  brand?: string;
  model?: string;
  year?: string;
  condition?: string;
  material?: string;
  dimensions?: string;
  provenance?: string;
  createdAt? : string;
  sellerId ? : string;
  seller 
};



const AuctionDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [auction, setAuction] = useState<AuctionDto | null>(null);
  const [recentBids, setRecentBids] = useState<Array<{ bidder: string; amount: number; time: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState("");
  const [isFavorited, setIsFavorited] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const hubRef = useRef<HubConnection | null>(null);
  const mountedRef = useRef(true);
  const [timeTick, setTimeTick] = useState(0);
  const [isEnded, setIsEnded] = useState(false);
  const [timeNowTick, setTimeNowTick] = useState(0); // triggers re-render to refresh remaining time

  const pushDebug = (m: string) => setDebugLog((d) => [...d, `${new Date().toISOString()} · ${m}`].slice(-50));
 
  const toDate = (val?: string | null): Date | null => {
     if (!val) return null;
     try {
       // 1. try your util first (if it returns a Date)
       const d1 = parseServerUtcToDate(val);
       if (d1 && !isNaN(d1.getTime())) return d1;
 
       // 2. handle Microsoft JSON /Date(1234567890)/
       const msMatch = /\/Date\((\d+)(?:[+-]\d+)?\)\//.exec(val);
       if (msMatch) {
         const ms = Number(msMatch[1]);
         const dms = new Date(ms);
         if (!isNaN(dms.getTime())) return dms;
       }
 
       // 3. try native parsing as-is
       const d2 = new Date(val);
       if (!isNaN(d2.getTime())) return d2;
 
       // 4. if no timezone present, assume UTC by appending Z
       // check if string looks like 'YYYY-MM-DDTHH:mm:ss' (no Z)
       if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(val)) {
         const d3 = new Date(val + "Z");
         if (!isNaN(d3.getTime())) return d3;
       }
 
       // 5. last attempt: parse replacing space with T then append Z
       const normalized = val.replace(" ", "T");
       const d4 = new Date(normalized.endsWith("Z") ? normalized : normalized + "Z");
       if (!isNaN(d4.getTime())) return d4;
     } catch (e) {
       // ignore and return null below
     }
 
     return null;
   };
 
  
 
   // tick every 15 seconds to refresh displayed remaining times
   useEffect(() => {
     const iv = setInterval(() => setTimeTick((t) => t + 1), 15000);
     return () => clearInterval(iv);
   }, []);  
const formatPrice = (p?: number) =>
  typeof p === "number" ? new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" }).format(p) : "—";

const formatTimeRemaining = (endTime?: string | null) => {
  if (!endTime) return "—";
  const end = toDate(endTime);
  if (!end) return "—";
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return "Ended";
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};


  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        if (!id) {
          pushDebug("No ID param provided");
          setLoading(false);
          return;
        }
        pushDebug(`Fetching auction ${id}`);
        const res = await api.get<AuctionDto>(`/auctions/${id}`);
        if (!mounted) return;
        setAuction(res.data);

        // set sensible default bid amount
        const base = res.data.currentPrice ?? res.data.startPrice ?? 0;
        setBidAmount(String(Math.max(Math.ceil((base * 1.05 || 1) / 250) * 250, (base ?? 0) + 1)));

        // If backend provides recent bids separately, call that endpoint; otherwise infer some bids if present
        try {
          const bidsRes = await api.get(`/bids/${id}`);
          if (mounted && bidsRes?.data) {
            // Expecting an array of { bidder, amount, time }
            setRecentBids(bidsRes.data.slice(-20).reverse());
          }
        } catch {
          // ignore; maybe backend doesn't expose bids endpoint
        }
        // check watchlist membership for current user (if logged in)
        try {
          const token = localStorage.getItem("token");
          if (token) {
            const wl = await api.get(`/watchlist`, { headers: { Authorization: `Bearer ${token}` } });
            const found = Array.isArray(wl.data) && wl.data.some((w: any) => w.auctionId === res.data.id);
            setIsFavorited(Boolean(found));
          }
        } catch (e: any) {
          // ignore 401 or other watchlist fetch errors silently (we'll show Save button)
          if (e?.response?.status === 401) pushDebug("Watchlist fetch returned 401 (not logged in)");
        }
        pushDebug("Auction loaded");
      } catch (err: any) {
        pushDebug(`Load failed: ${err?.message ?? String(err)}`);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const showDate = (val?: string) =>
  val ? val.split("T")[0] : "—";

  // --- Countdown + end detection (run after auction is loaded) ---
  /*useEffect(() => {
    if (!auction?.endTime) return;

    const checkIfEnded = () => {
      try {
        const end = parseServerUtcToDate(auction.endTime);
        if (!end) return;
        const now = new Date();
        if (end.getTime() <= now.getTime()) {
          setIsEnded(true);
          setAuction((a) => (a ? { ...a, status: "Ended" } : a));
        } else {
          setIsEnded(false);
        }
      } catch (e) {
        console.error("countdown check failed", e);
      }
    };
    checkIfEnded();

    // update every 15s so remaining time and end detection stays accurate
    const iv = setInterval(() => {
      setTimeNowTick((t) => t + 1);
      checkIfEnded();
    }, 15000);

    return () => clearInterval(iv);
  }, [auction?.endTime]);*/

  // SignalR — subscribe to auction updates (live)
  useEffect(() => {
    const token = localStorage.getItem("token") ?? undefined;
    const envSignalR = (import.meta.env as any).VITE_SIGNALR_URL as string | undefined;
    const apiUrl = (import.meta.env as any).VITE_API_URL as string | undefined;
    const fallback = apiUrl ? `${apiUrl.replace(/\/api\/?$/, "").replace(/\/$/, "")}/hubs/auction` : `${window.location.origin}/hubs/auction`;
    const hubUrl = envSignalR ?? fallback;

    pushDebug(`SignalR will try ${hubUrl}`);

    const conn = new HubConnectionBuilder()
      .withUrl(hubUrl, { accessTokenFactory: () => (token ? token : undefined) })
      .configureLogging(LogLevel.Warning)
      .withAutomaticReconnect()
      .build();

    hubRef.current = conn;

    // Unified handler for BidPlaced payloads (array or object)
    const bidHandler = (payload: any) => {
      pushDebug(`SignalR BidPlaced received: ${JSON.stringify(payload)}`);
      try {
        // array shape: [auctionId, newPrice, newBidCount] OR custom arrays
        if (Array.isArray(payload) && payload.length >= 3) {
          const [auctionId, newPrice, newBidCount] = payload;
          if (String(auctionId) === String(id)) {
            setAuction((a) => (a ? { ...a, currentPrice: newPrice ?? a.currentPrice, bidCount: newBidCount ?? a.bidCount } : a));
            setRecentBids((r) => [{ bidder: "Live", amount: newPrice ?? 0, time: new Date().toISOString() }, ...r].slice(0, 20));
          }
          return;
        }

        // object shape: { id / auctionId, amount, bidderId, time, currentPrice, bidCount }
        const aid = payload?.AuctionId ?? payload?.auctionId ?? payload?.id;
        if (aid && String(aid) === String(id)) {
          // update auction current price if present
          const newPrice = payload?.CurrentPrice ?? payload?.currentPrice ?? payload?.amount ?? payload?.Amount;
          const newBidCount = payload?.BidCount ?? payload?.bidCount;
          if (typeof newPrice === "number") {
            setAuction((a) => (a ? { ...a, currentPrice: newPrice, bidCount: newBidCount ?? a.bidCount } : a));
          } else if (typeof payload.currentPrice === "number") {
            setAuction((a) => (a ? { ...a, currentPrice: payload.currentPrice, bidCount: newBidCount ?? a.bidCount } : a));
          }

          // add to recent bids if we have amount
          const amount = payload?.Amount ?? payload?.amount ?? payload?.currentPrice ?? null;
          const bidder = payload?.BidderId ?? payload?.bidder ?? payload?.Bidder ?? "Bidder";
          const time = payload?.Time ?? payload?.time ?? new Date().toISOString();
          if (amount != null) {
            setRecentBids((r) => [{ bidder, amount: Number(amount), time: new Date(time).toISOString() }, ...r].slice(0, 20));
          }
        }
      } catch (e) {
        pushDebug("Error processing BidPlaced payload");
        console.error(e);
      }
    };

    const auctionUpdatedHandler = (payload: any) => {
      pushDebug(`SignalR AuctionUpdated: ${JSON.stringify(payload)}`);
      try {
        const aid = payload?.id ?? payload?.AuctionId ?? payload?.auctionId;
        if (aid && String(aid) === String(id)) {
          // merge payload into auction state
          setAuction((a) => ({ ...(a ?? {}), ...payload }));
        }
      } catch (e) {
        console.error("AuctionUpdated handler error", e);
      }
    };

    const auctionEndedHandler = (payload: any) => {
      pushDebug(`SignalR AuctionEnded: ${JSON.stringify(payload)}`);
      try {
        const aid = payload?.AuctionId ?? payload?.auctionId ?? payload?.id ?? payload;
        if (String(aid) === String(id)) {
          setIsEnded(true);
          setAuction((a) => (a ? { ...a, status: "Ended" } : a));
          // optional: include final winner info in recentBids or show toast
        }
      } catch (e) {
        console.error("AuctionEnded handler error", e);
      }
    };

    const auctionClosedHandler = (payload: any) => {
      pushDebug(`SignalR AuctionClosed: ${JSON.stringify(payload)}`);
      try {
        const aid = payload?.AuctionId ?? payload?.auctionId ?? payload?.id ?? payload;
        if (String(aid) === String(id)) {
          setIsEnded(true);
          setAuction((a) => (a ? { ...a, status: "Ended" } : a));
        }
      } catch (e) {
        console.error("AuctionClosed handler error", e);
      }
    };

    const watchlistHandler = (auctionId: number, added: boolean) => {
      pushDebug(`SignalR WatchlistChanged: auctionId=${auctionId} added=${added}`);
      if (String(auctionId) === String(id)) {
        setIsFavorited(Boolean(added));
      }
    };

    // register handlers BEFORE start to avoid missing events
    conn.on("BidPlaced", bidHandler);
    conn.on("AuctionUpdated", auctionUpdatedHandler);
    conn.on("AuctionEnded", auctionEndedHandler);
    conn.on("AuctionClosed", auctionClosedHandler); // hosted service / resolver uses this name
    conn.on("WatchlistChanged", watchlistHandler);

    // rejoin auction room after reconnect because server clears groups
    conn.onreconnected((connectionId) => {
      pushDebug(`SignalR reconnected: ${connectionId}`);
      if (id) {
        conn.invoke("JoinAuctionRoom", `${id}`).catch((e) => {
          pushDebug(`Re-join auction room failed: ${e?.message ?? e}`);
        });
      }
    });

    conn.onclose((err) => {
      pushDebug(`SignalR connection closed: ${err?.message ?? "no error"}`);
    });

    // start connection
    conn
      .start()
      .then(() => {
        pushDebug("SignalR connected");
        // join auction room (server hub method: JoinAuctionRoom)
        if (id) {
          conn.invoke("JoinAuctionRoom", `${id}`).catch((e) => {
            pushDebug(`JoinAuctionRoom invoke failed: ${e?.message ?? e}`);
          });
        }
      })
      .catch((err) => {
        pushDebug(`SignalR start failed: ${err?.message ?? String(err)}`);
      });

    // cleanup
    return () => {
      if (hubRef.current) {
        try {
          hubRef.current.off("BidPlaced", bidHandler);
          hubRef.current.off("AuctionUpdated", auctionUpdatedHandler);
          hubRef.current.off("AuctionEnded", auctionEndedHandler);
          hubRef.current.off("AuctionClosed", auctionClosedHandler);
          hubRef.current.off("WatchlistChanged", watchlistHandler);
          hubRef.current.stop().catch(() => {});
        } catch {}
        hubRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <div className="p-8">Loading auction…</div>;
  if (!auction) return <div className="p-8">Auction not found.</div>;

  // category may be string or object — normalize safely
  const categoryName =
    typeof auction.category === "string"
      ? auction.category
      : auction.category && (auction.category as CategoryObj).name
      ? (auction.category as CategoryObj).name
      : "Uncategorized";

  const currentPrice = auction.currentPrice ?? auction.startPrice ?? 0;
  const nextBidIncrement = Math.ceil((currentPrice * 1.05 || 1) / 250) * 250;

  // image handling: if imageUrl is absolute use it, otherwise try to attach backend origin
  const safeImage = auction.imageUrl
    ? auction.imageUrl.startsWith("http")
      ? auction.imageUrl
      : ((import.meta.env as any).VITE_API_URL ? `${(import.meta.env as any).VITE_API_URL.replace(/\/api\/?$/, "")}${auction.imageUrl}` : auction.imageUrl)
    : undefined;

  // Place bid function (calls backend, optimistic update)
  const placeBid = async () => {
    try {
      // guard: auction ended?
      if (isEnded) {
        alert("This auction has ended — bids are no longer accepted.");
        pushDebug("Prevented PlaceBid: auction ended (client)");
        return;
      }

      const token = localStorage.getItem("token");
      if (!token) {
        pushDebug("PlaceBid blocked: no token");
        alert("Please login to place a bid.");
        return;
      }

      const amount = Number(bidAmount);
      if (isNaN(amount) || amount <= (auction?.currentPrice ?? 0)) {
        alert("Please enter a valid bid amount higher than the current price.");
        return;
      }

      // optimistic update
      const prevPrice = auction?.currentPrice ?? 0;
      const prevCount = auction?.bidCount ?? 0;
      setAuction((a) => (a ? { ...a, currentPrice: amount, bidCount: (a.bidCount ?? 0) + 1 } : a));
      setRecentBids((r) => [{ bidder: "You", amount, time: new Date().toISOString() }, ...r].slice(0, 20));

      // POST to API (your server expects /api/auctions/{id}/placebid)
      try {
        await api.post(
          `/auctions/${auction?.id}/placebid`,
          { amount },
          { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
        );
      } catch (e: any) {
        // revert optimistic on failure
        setAuction((a) => (a ? { ...a, currentPrice: prevPrice, bidCount: prevCount } : a));
        setRecentBids((r) => r.slice(1)); // remove optimistic entry
        const msg = e?.response?.data?.message ?? e?.response?.data ?? e?.message ?? "Bid failed";
        pushDebug(`PlaceBid failed: ${msg}`);
        alert(`Bid failed: ${msg}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle watchlist (calls backend; server will broadcast WatchlistChanged to user's connections)
  const toggleWatchlist = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Please login to save to your watchlist.");
        return;
      }

      const newVal = !isFavorited;
      setIsFavorited(newVal); // optimistic

      if (!isFavorited) {
        await api.post(`/watchlist/${auction?.id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await api.delete(`/watchlist/${auction?.id}`, { headers: { Authorization: `Bearer ${token}` } });
      }
      // server will broadcast and reconcile across tabs
    } catch (e: any) {
      setIsFavorited((v) => !v); // revert
      pushDebug(`Watchlist toggle failed: ${e?.message ?? String(e)}`);
      if (e?.response?.status === 401) alert("Not authorized. Please login.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-6">
            <div className="relative">
              {safeImage ? (
                <img src={safeImage} alt={auction.title} className="w-full h-[600px] object-cover rounded-lg auction-shadow-elegant" />
              ) : (
                <div className="w-full h-[600px] rounded-lg bg-muted/20 flex items-center justify-center">No image</div>
              )}
              {/* Live indicator */}
              {auction.status === "Live" || auction.status === 2 ? (
                <Badge className="absolute top-4 left-4 bg-red-500 text-white animate-pulse px-3 py-1">LIVE AUCTION</Badge>
              ) : null}
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <Badge className="mb-3 bg-auction-navy text-white">{categoryName}</Badge>
              <h1 className="text-3xl font-bold text-auction-navy mb-2">{auction.title}</h1>
              {/*<p className="text-muted-foreground text-lg">{auction.description}</p>*/}
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-lg text-muted-foreground">Current Bid</span>
                <span className="text-3xl font-bold text-auction-gold">{formatPrice(currentPrice)}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>Starting bid: {formatPrice(auction.startPrice)}</div>
                <div>Estimate: {auction.estimate ?? "—"}</div>
                <div className="flex items-center space-x-1">
                  <Users className="h-4 w-4" />
                  <span>{auction.bidCount ?? 0} bids</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>{formatTimeRemaining(auction.endTime)}</span>
                </div>
              </div>
            </div>

            <Card className="auction-shadow-gold">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Gavel className="h-5 w-5 text-auction-gold" />
                  <span>Place Your Bid</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex space-x-2">
                  <Input
                    type="number"
                    placeholder={`Minimum: ${formatPrice(nextBidIncrement)}`}
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="flex-1"
                    readOnly={isEnded}
                  />
                  <Button variant="premium" className="px-6" onClick={placeBid} disabled={isEnded}>
                    Place Bid
                  </Button>
                </div>

                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setBidAmount(nextBidIncrement.toString())} disabled={isEnded}>
                    {formatPrice(nextBidIncrement)}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setBidAmount((nextBidIncrement + 500).toString())} disabled={isEnded}>
                    {formatPrice(nextBidIncrement + 500)}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setBidAmount((nextBidIncrement + 1000).toString())} disabled={isEnded}>
                    {formatPrice(nextBidIncrement + 1000)}
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground">By placing a bid, you agree to our Terms and Conditions</p>

                {isEnded && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    This auction ended at {auction?.endTime ? parseServerUtcToDate(auction.endTime)?.toLocaleString() : "—"}. Bidding is closed.
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex space-x-3">
              <Button variant="ghost" onClick={toggleWatchlist} className={isFavorited ? "text-red-500" : ""}>
                <Heart className={`h-5 w-5 mr-2 ${isFavorited ? "fill-current" : ""}`} />
                {isFavorited ? "Saved" : "Save"}
              </Button>
              <Button variant="ghost">
                <Share2 className="h-5 w-5 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-12">
  <Tabs defaultValue="details" className="w-full">
    {/* Tabs */}
    <TabsList className="flex w-full rounded-xl bg-muted p-1">
      <TabsTrigger
        value="details"
        className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow"
      >
        Details
      </TabsTrigger>
      <TabsTrigger
        value="bidding"
        className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow"
      >
        Bidding History
      </TabsTrigger>
      <TabsTrigger
        value="condition"
        className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow"
      >
        Condition Report
      </TabsTrigger>
    </TabsList>

    {/* DETAILS */}
    <TabsContent value="details" className="mt-6">
      <Card className="rounded-2xl border border-border shadow-sm">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Item Details */}
            <div>
              <h3 className="mb-4 text-lg font-semibold text-auction-navy">
                Item Details
              </h3>

              <div className="space-y-3 text-sm">
                {[
                  ["Item Name", auction.title],
                  ["Category", categoryName],
                  ["Owner Name", auction.seller?.displayName],
                  ["Starting Price", formatPrice(auction.startPrice)],
                  ["Created", showDate(auction.createdAt)],
                ].map(([label, value], i) => (
                  <div
                    key={i}
                    className="flex justify-between border-b pb-2 last:border-0"
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium text-right">
                      {value ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Provenance */}
            <div>
              <h3 className="mb-4 text-lg font-semibold text-auction-navy">
                Provenance
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Condition</span>
                  <span className="font-medium">
                    {auction.condition ?? "90%"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Provenance</span>
                  <span className="font-medium">
                    {auction.provenance ?? "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>

    {/* BIDDING */}
<TabsContent value="bidding" className="mt-6">
  <Card className="rounded-2xl border border-border shadow-sm">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-auction-navy">
        <TrendingUp className="h-5 w-5 text-auction-gold" />
        Recent Bidding Activity
      </CardTitle>
    </CardHeader>

    <CardContent>
      {recentBids.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No bids placed yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {/* Table Header */}
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-left font-medium">Time</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {recentBids.map((b, i) => {
                const dateObj = new Date(b.time);
                return (
                  <tr
                    key={i}
                    className="border-b last:border-0 hover:bg-muted/30 transition"
                  >
                    <td className="px-4 py-2 font-medium">
                      {b.bidder}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {dateObj.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {dateObj.toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {formatPrice(b.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </CardContent>
  </Card>
</TabsContent>


    {/* CONDITION */}
    <TabsContent value="condition" className="mt-6">
      <Card className="rounded-2xl border border-border shadow-sm">
        <CardContent className="p-6">
          <h3 className="mb-3 text-lg font-semibold text-auction-navy">
            Condition Report
          </h3>
          <div className="prose prose-sm max-w-none text-muted-foreground">
            {auction.description ?? "No condition report available."}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  </Tabs>
</div>


        {/* Dev debug log (collapse in production) */}
      { /* <div className="mt-6 p-3 bg-slate-50 text-sm text-slate-700 rounded">
          <strong>Debug:</strong>
          <ul className="list-disc pl-6">
            {debugLog.slice(-8).map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>*/}
        
      </div>
    </div>
  );
};

export default AuctionDetails;
