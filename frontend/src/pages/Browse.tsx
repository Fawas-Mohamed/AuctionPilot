import React, { useEffect, useState } from "react";
import axios from "axios";
import { HubConnectionBuilder, HubConnection } from "@microsoft/signalr";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Users, Clock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";

interface Category {
  id: number;
  name: string;
  imageUrl?: string | null;
}

interface Auction {
  id: number;
  title: string;
  description: string;
  imageUrl: string | null;
  startPrice: number;
  currentPrice: number;
  startTime: string;
  endTime: string;
  createdById: string | null;
  status: number;
  bidCount: number;
  categoryId?: number | null;
  category?: Category | null;
}

const AuctionsPage: React.FC = () => {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [connection, setConnection] = useState<HubConnection | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<
    "ending-soon" | "newest" | "price-low" | "price-high" | "most-bids"
  >("ending-soon");

  const navigate = useNavigate();
  const apiBase = (import.meta.env.VITE_API_URL ?? "https://localhost:62628").replace(/\/$/, "");
  const signalRUrl = import.meta.env.VITE_SIGNALR_URL ?? `${apiBase.replace(/\/api$|\/$/, "")}/hubs/auction`;

  // helper: safe image normalization
  const normalizeImage = (imageUrl: string | null | undefined) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith("http")) return imageUrl;
    return `https://localhost:62628${imageUrl}`;
  };

  // fetch auctions + categories
  useEffect(() => {
    void fetchAuctions();
    void fetchCategories();
  }, []);

  const fetchAuctions = async () => {
    try {
      const res = await api.get("/auctions");
      setAuctions(res.data ?? []);
    } catch (err) {
      console.error("Failed to load auctions", err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get("/categories");
      setCategories(res.data ?? []);
    } catch (err) {
      console.warn("Failed to load categories", err);
      setCategories([]);
    }
  };

const formatPrice = (p?: number) =>
  typeof p === "number" ? new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" }).format(p) : "—";

  const formatTimeRemaining = (endTime: string) => {
    const end = new Date(endTime).getTime();
    const now = Date.now();
    const diff = end - now;
    if (diff <= 0) return "Ended";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // Setup SignalR connection
  useEffect(() => {
    const tokenFactory = () => localStorage.getItem("token") ?? "";
    const newConnection = new HubConnectionBuilder()
      .withUrl(signalRUrl, { accessTokenFactory: tokenFactory })
      .withAutomaticReconnect()
      .build();

    setConnection(newConnection);
    return () => {
      newConnection.stop().catch(() => {});
    };
  }, [signalRUrl]);

  useEffect(() => {
    if (!connection) return;
    let started = false;
    connection
      .start()
      .then(() => {
        started = true;
        console.log("Connected to auction hub");

        connection.on("AuctionCreated", (auctionObj: Auction) => {
          setAuctions((prev) => [auctionObj, ...prev]);
        });

        connection.on("BidPlaced", (payload: any) => {
          const auctionId = payload.AuctionId ?? payload.auctionId ?? payload.id;
          const newPrice = payload.CurrentPrice ?? payload.currentPrice ?? payload.amount;
          const bidCount = payload.BidCount ?? payload.bidCount;
          if (auctionId != null) {
            setAuctions((prev) =>
              prev.map((a) =>
                a.id === auctionId
                  ? { ...a, currentPrice: newPrice ?? a.currentPrice, bidCount: bidCount ?? a.bidCount }
                  : a
              )
            );
          }
        });
      })
      .catch((err) => console.error("SignalR Connection Error:", err));

    return () => {
      if (started) {
        connection.off("AuctionCreated");
        connection.off("BidPlaced");
      }
    };
  }, [connection]);

  // fast lookup map for categories
  const categoriesMap = React.useMemo(() => {
    const m = new Map<number, Category>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  // combined filter + search + sort
  const visibleAuctions = React.useMemo(() => {
    const filtered = auctions.filter((a) => {
      const matchesCategory =
        selectedCategory === "all"
          ? true
          : (a.categoryId ?? a.category?.id ?? null) === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (a.title ?? "").toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "ending-soon":
          return new Date(a.endTime).getTime() - new Date(b.endTime).getTime();
        case "newest":
          return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
        case "price-low":
          return (a.currentPrice ?? a.startPrice) - (b.currentPrice ?? b.startPrice);
        case "price-high":
          return (b.currentPrice ?? b.startPrice) - (a.currentPrice ?? a.startPrice);
        case "most-bids":
          return b.bidCount - a.bidCount;
        default:
          return 0;
      }
    });
  }, [auctions, selectedCategory, searchQuery, sortBy]);

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-auction-navy to-auction-navy-light text-white py-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Browse Auctions</h1>
            <p className="text-xl text-gray-200 mb-8">
              Discover exceptional pieces from our curated collection of fine art, luxury goods, and rare collectibles
            </p>
            <div className="relative max-w-lg mx-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search auctions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-3 bg-white text-black"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Filters & Controls */}
      <section className="bg-secondary/20 border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Categories */}
            <div className="flex flex-wrap gap-2">
              <Badge
                key="all"
                onClick={() => setSelectedCategory("all")}
                className={`cursor-pointer auction-transition ${
                  selectedCategory === "all"
                    ? "bg-auction-gold text-auction-navy hover:bg-auction-gold-light"
                    : "hover:bg-auction-gold hover:text-auction-navy"
                }`}>
                All
              </Badge>
              {categories.map((c) => (
                <Badge
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`cursor-pointer auction-transition ${
                    selectedCategory === c.id
                      ? "bg-auction-gold text-auction-navy hover:bg-auction-gold-light"
                      : "hover:bg-auction-gold hover:text-auction-navy"
                  }`}>
                  {c.name}
                </Badge>
              ))}
            </div>

            {/* Sort */}
            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="border rounded px-3 py-2">
                <option value="ending-soon">Ending Soon</option>
                <option value="newest">Newest First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="most-bids">Most Bids</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Auction Grid */}
      <section className="container mx-auto px-4 py-10">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleAuctions.map((auction) => {
            const category =
              auction.category ??
              (auction.categoryId ? categoriesMap.get(auction.categoryId) ?? null : null);
            return (
              <Card
                key={auction.id}
                className="group auction-gradient-card hover:auction-shadow-elegant auction-transition cursor-pointer overflow-hidden">
                <div className="relative">
                  <img
                    src={normalizeImage(auction.imageUrl) ?? ""}
                    alt={auction.title}
                    className="w-full h-64 object-cover group-hover:scale-105 auction-transition"/>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-3 right-3 text-white bg-black/20 hover:bg-black/40">
                    <Heart className="h-5 w-5" />
                  </Button>
                  {new Date(auction.endTime) > new Date() && (
                    <Badge className="absolute top-3 left-3 bg-red-500 text-white animate-pulse">
                      LIVE
                    </Badge>
                  )}
                  <Badge className="absolute bottom-3 left-3 bg-auction-navy text-white">
                    {category?.name ?? "Uncategorized"}
                  </Badge>
                </div>

                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-auction-navy group-hover:text-auction-gold auction-transition line-clamp-1">
                        {auction.title}
                      </h3>
                      <p className="text-muted-foreground text-sm mt-1 line-clamp-2">
                        {auction.description}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Current Bid</span>
                        <span className="text-xl font-bold text-auction-gold">
                          {formatPrice(auction.currentPrice ?? auction.startPrice)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Starting: {formatPrice(auction.startPrice)}</span>
                        <div className="flex items-center space-x-1">
                          <Users className="h-4 w-4" />
                          <span>{auction.bidCount} bids</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{formatTimeRemaining(auction.endTime)}</span>
                      </div>
                      <Link to={`/auctions/${auction.id}`}>
                        <Button
                          variant="bid"
                          size="sm"
                          disabled={new Date(auction.endTime) < new Date()}>
                          Place Bid
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {visibleAuctions.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground p-8 rounded bg-white shadow-sm">
              No auctions found.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default AuctionsPage;
