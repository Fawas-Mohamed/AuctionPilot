// src/pages/MyAuctions.tsx
import React, { useEffect, useState } from "react";
import { Plus, Eye, Edit, Trash2, Clock, DollarSign, Users, BarChart, Banknote } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import api from "@/lib/api";
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";

const MyAuctions: React.FC = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [auctions, setAuctions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [myBids, setMyBids] = useState<any[]>([]);

  const loadMyBids = async () => {
  try {
    const res = await api.get("/bids/my-bids");
    setMyBids(res.data ?? []);
  } catch (err) {
    console.error("Load my bids failed", err);
  }
};

loadMyBids();



  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get("/auctions/my");
        if (!mounted) return;
        setAuctions(res.data ?? []);
      } catch (err) {
        console.error("Load my auctions failed", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();

    // SignalR - try environment variable first, fallback to API url -> hub path
    const token = localStorage.getItem("token") ?? "";
    const envSignalR = (import.meta.env.VITE_SIGNALR_URL as string | undefined);
    const apiUrl = (import.meta.env.VITE_API_URL as string | undefined);
    const fallbackHub = apiUrl
      ? apiUrl.replace(/\/api\/?$/, "").replace(/\/$/, "") + "/hubs/auction"
      : window.location.origin + "/hubs/auction";

    const hubUrl = envSignalR ?? fallbackHub;

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    connection.start().catch((e) => {
      console.warn("SignalR start failed:", e);
    });

    // When a new auction is created, if it belongs to the current user we'll add it.
    connection.on("AuctionCreated", (payload: any) => {
      // payload may include SellerId or CreatedById
      const myId = (localStorage.getItem("userId") ?? null);
      const seller = payload?.SellerId ?? payload?.CreatedById ?? null;
      if (!myId) {
        // alternatively, we could refresh list irrespective
        // attempt to refresh from server to be safe
        api.get("/auctions/my").then(r => setAuctions(r.data)).catch(()=>{});
        return;
      }
      if (String(seller) === String(myId)) {
        setAuctions(prev => [payload, ...prev]);
      }
    });

    // AuctionUpdated/BidPlaced: refresh the changed auction locally
    connection.on("AuctionUpdated", (payload: any) => {
      if (!payload?.Id && !payload?.id) return;
      const id = payload?.Id ?? payload?.id;
      setAuctions(prev => prev.map(a => (a.id === id ? { ...a, ...payload } : a)));
    });

    connection.on("BidPlaced", (payload: any) => {
      const id = payload?.auctionId ?? payload?.AuctionId ?? payload?.AuctionId;
      if (!id) return;
      setAuctions(prev => prev.map(a => a.id === id ? { ...a, currentPrice: payload.currentPrice ?? payload.CurrentPrice ?? a.currentPrice, bidCount: payload.bidCount ?? payload.BidCount ?? a.bidCount } : a));
    });

    return () => {
      mounted = false;
      connection.stop().catch(()=>{});
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Live":
      case "live": return "bg-green-100 text-green-800";
      case "Scheduled":
      case "scheduled":
      case "upcoming": return "bg-blue-100 text-blue-800";
      case "Closed":
      case "closed":
      case "completed": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) return (
    <div className="min-h-screen">
      <div className="container mx-auto p-6">Loading your auctions...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-4xl font-bold auction-gradient-text">My Auctions</h1>
              <p className="text-lg text-muted-foreground">Manage your auction listings and track performance</p>
            </div>
            <Button variant="premium" size="lg" onClick={() => navigate("/auctions/create")}>
              <Plus className="w-4 h-4 mr-2" />
              Create New Auction
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="auction-shadow-elegant">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <BarChart className="w-8 h-8 text-auction-premium" />
                  <div>
                    <div className="text-2xl font-bold text-auction-navy">{auctions.length}</div>
                    <div className="text-sm text-muted-foreground">Your Auctions</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="auction-shadow-elegant">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Eye className="w-8 h-8 text-auction-premium" />
                  <div>
                    <div className="text-2xl font-bold text-auction-navy">{auctions.reduce((s, a) => s + (a.bidCount ?? 0), 0)}</div>
                    <div className="text-sm text-muted-foreground">Total Bids</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="auction-shadow-elegant">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Users className="w-8 h-8 text-auction-premium" />
                  <div>
                    <div className="text-2xl font-bold text-auction-navy">{/* placeholder */}</div>
                    <div className="text-sm text-muted-foreground">Active Bidders</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="auction-shadow-elegant">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Banknote className="w-8 h-8 text-auction-premium" />
                  <div>
                    <div className="text-2xl font-bold text-auction-navy">{auctions.reduce((s, a) => s + (a.currentPrice ?? 0), 0).toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Combined Current Value</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="auctions">My Auctions</TabsTrigger>
              <TabsTrigger value="lots">Active Lots</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-8">
  <div className="grid gap-6">
    <Card className="rounded-2xl border border-border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-auction-navy">
          My Recent Bids
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {myBids.length === 0 && (
          <p className="text-muted-foreground text-sm">
            You haven’t placed any bids yet.
          </p>
        )}

        {myBids.map((bid) => {
          const d = new Date(bid.time);

          return (
            <div
              key={bid.id}
              className="
                group flex items-center justify-between
                rounded-xl border p-4
                hover:bg-muted/40 transition
              "
            >
              {/* Left */}
              <div className="space-y-1">
                <p className="font-semibold text-auction-navy group-hover:underline">
                  {bid.auctionTitle}
                </p>

                <div className="flex items-center gap-6 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {d.toLocaleDateString()}
                  </span>

                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {d.toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {/* Right */}
              <div className="flex items-center gap-4">
                <span className="font-semibold text-sm">
                  {bid.amount.toLocaleString()}
                </span>

                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition"
                  onClick={() => navigate(`/auction/${bid.auctionId}`)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  </div>
</TabsContent>


            <TabsContent value="auctions" className="mt-8">
              <div className="grid gap-6">
                {auctions.map((auction) => (
                  <Card key={auction.id} className="auction-shadow-elegant hover:scale-[1.02] auction-transition">
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row gap-6">
                        <div className="w-full lg:w-48 aspect-[4/3] overflow-hidden rounded-lg bg-muted">
  <img
    src={
      auction.imageUrl.startsWith("http")
        ? auction.imageUrl
        : `https://localhost:62628${auction.imageUrl}`
    }
    alt={auction.title}
    className="w-full h-full object-cover"
  />
</div>

                        <div className="flex-1 space-y-4">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div>
                              <h3 className="text-xl font-bold text-auction-navy mb-2">{auction.title}</h3>
                              <div className="flex items-center gap-2">
                                <Badge className={getStatusColor(auction.status)}>
                                  {auction.status}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {new Date(auction.startTime).toLocaleString()} - {new Date(auction.endTime).toLocaleString()}
                                </span>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => navigate(`/auctions/${auction.id}`)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => navigate(`/auctions/${auction.id}/edit`)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </Button>
                              {auction.status === "upcoming" && (
                                <Button variant="outline" size="sm" className="text-red-500 hover:text-red-700">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <div className="text-sm text-muted-foreground">Start Price</div>
                              <div className="text-xl font-bold text-auction-navy">${(auction.startPrice ?? 0).toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">Current</div>
                              <div className="text-xl font-bold text-auction-premium">${(auction.currentPrice ?? 0).toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">Bids</div>
                              <div className="text-xl font-bold">{auction.bidCount ?? 0}</div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">Created</div>
                              <div className="text-xl font-bold">{new Date(auction.createdAt ?? auction.createdAt).toLocaleDateString()}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="lots" className="mt-8">
              <div className="grid gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div>No lots UI implemented — use individual auction pages to manage lots.</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default MyAuctions;
