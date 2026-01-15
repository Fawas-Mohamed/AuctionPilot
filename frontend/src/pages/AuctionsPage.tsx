// src/pages/AuctionsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { HubConnectionBuilder, HubConnection } from "@microsoft/signalr";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Users, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { formatServerUtc, parseServerUtcToDate } from "@/utils/formatServerUtc";
import {  useRef} from "react";
import { ChevronsUpDown, Check } from "lucide-react";


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
  const [timeTick, setTimeTick] = useState(0); // triggers countdown refresh
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);


  const apiBase = (import.meta.env.VITE_API_URL ?? "https://localhost:62628").replace(/\/$/, "");
  const signalRUrl = import.meta.env.VITE_SIGNALR_URL ?? `${apiBase.replace(/\/api$|\/$/, "")}/hubs/auction`;

  // helper: normalize image URL (if relative -> prefix with API base)
 
  const normalizeImage = (imageUrl: string | null | undefined) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith("http")) return imageUrl;
    return `https://localhost:62628${imageUrl}`;
  };
  const dropdownRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setDropdownOpen(false);
    }
  };
  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, []);


  // Robust parser: prefer existing util, but tolerate variants
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

  useEffect(() => {
    void fetchAuctions();
    void fetchCategories();
  }, []);

  // tick every 15 seconds to refresh displayed remaining times
  useEffect(() => {
    const iv = setInterval(() => setTimeTick((t) => t + 1), 15000);
    return () => clearInterval(iv);
  }, []);

  const fetchAuctions = async () => {
    try {
      const res = await axios.get<Auction[]>("https://localhost:62628/api/auctions");
      setAuctions(res.data ?? []);
    } catch (err) {
      console.error("Failed to load auctions", err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get<Category[]>("https://localhost:62628/api/categories");
      setCategories(res.data ?? []);
    } catch (err) {
      console.warn("Failed to load categories", err);
      setCategories([]);
    }
  };

const formatPrice = (p?: number) =>
  typeof p === "number" ? new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" }).format(p) : "—";

  // better time formatter with days/hours/minutes
  const formatTimeRemaining = (endTime?: string | null) => {
    if (!endTime) return "—";
    const end = toDate(endTime);
    if (!end) return "—";
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    if (diffMs <= 0) return "Ended";
    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Setup SignalR connection for realtime updates
  useEffect(() => {
    const tokenFactory = () => localStorage.getItem("token") ?? "";
    const newConnection = new HubConnectionBuilder()
      .withUrl(signalRUrl, { accessTokenFactory: tokenFactory })
      .withAutomaticReconnect()
      .build();

    setConnection(newConnection);

    return () => {
      // ensure we stop the connection when component unmounts
      newConnection.stop().catch(() => {});
    };
    // signalRUrl rarely changes; keep it in deps by intention
  }, [signalRUrl]);

  useEffect(() => {
    if (!connection) return;

    let started = false;

    // handlers
    const onAuctionCreated = (payload: any, ...rest: any[]) => {
      let auctionObj: Auction | null = null;

      if (payload && typeof payload === "object" && (payload.id != null || payload.Id != null)) {
        // map Id -> id if backend uses PascalCase
        const normalized = { ...payload } as any;
        if (normalized.Id && !normalized.id) normalized.id = normalized.Id;
        auctionObj = normalized as Auction;
      } else if (rest && rest.length && rest[0] && rest[0].id != null) {
        auctionObj = rest[0] as Auction;
      }
      if (auctionObj) {
        setAuctions((prev) => [auctionObj as Auction, ...prev]);
      } else {
        void fetchAuctions();
      }
    };

    const onBidPlaced = (...args: any[]) => {
      // Accept multiple shapes:
      // 1) single object payload
      // 2) array [auctionId, newPrice, bidCount]
      // otherwise refresh
      if (args.length === 1 && typeof args[0] === "object") {
        const payload = args[0];
        const auctionId = payload.AuctionId ?? payload.auctionId ?? payload.id;
        const newPrice = payload.CurrentPrice ?? payload.currentPrice ?? payload.amount;
        const bidCount = payload.BidCount ?? payload.bidCount;
        if (auctionId != null) {
          setAuctions((prev) =>
            prev.map((a) => (a.id === auctionId ? { ...a, currentPrice: newPrice ?? a.currentPrice, bidCount: bidCount ?? a.bidCount } : a))
          );
        }
        return;
      }

      if (args.length >= 3) {
        const [auctionId, newPrice, bidCount] = args;
        setAuctions((prev) =>
          prev.map((a) => (a.id === auctionId ? { ...a, currentPrice: newPrice ?? a.currentPrice, bidCount: bidCount ?? a.bidCount } : a))
        );
        return;
      }

      // unknown shape -> refresh list
      void fetchAuctions();
    };

    // attach BEFORE start to avoid missing events
    connection.on("AuctionCreated", onAuctionCreated);
    connection.on("BidPlaced", onBidPlaced);

    connection
      .start()
      .then(() => {
        started = true;
        console.log("Connected to auction hub");
      })
      .catch((err) => {
        console.error("SignalR Connection Error:", err);
      });

    return () => {
      if (started) {
        connection.off("AuctionCreated", onAuctionCreated);
        connection.off("BidPlaced", onBidPlaced);
        // leave any groups if necessary in your hub methods
      }
    };
  }, [connection]);

  const categoriesMap = useMemo(() => {
    const m = new Map<number, Category>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  const visibleAuctions = auctions.filter((a) => {
    if (selectedCategory === "all") return true;
    return (a.categoryId ?? a.category?.id ?? null) === selectedCategory;
  });

  return (
    <div>
      <section className="bg-gradient-to-r from-auction-navy to-auction-navy-light text-white py-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">All Categories Auctions</h1>
            <p className="text-xl text-gray-200 mb-8">
              Explore unique treasures from our collection of fine art, luxury items, and rare collectibles.
            </p>
          </div>
        </div>
      </section>

      <div className="p-12 ">
        <div ref={dropdownRef} className="relative w-56">
      <button
        type="button"
        className="w-full cursor-pointer rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm flex justify-between items-center"
        onClick={() => setDropdownOpen((o) => !o)}
      >
        <span className="truncate">
          {selectedCategory === "all"
            ? "All categories"
            : categories.find((c) => c.id === selectedCategory)?.name}
        </span>
        <ChevronsUpDown className="h-5 w-5 text-gray-400" />
      </button>

      {dropdownOpen && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 shadow-lg sm:text-sm">
          <li
            key="all"
            className={`cursor-pointer select-none py-2 pl-10 pr-4 hover:bg-gradient-to-br from-auction-gold to-yellow-600 hover:text-white ${
              selectedCategory === "all" ? "font-semibold" : "font-normal"
            }`}
            onClick={() => {
              setSelectedCategory("all");
              setDropdownOpen(false);
            }}
          >
            {selectedCategory === "all" && (
              <Check className="absolute left-3 top-2.5 h-5 w-5 text-gradient-to-br from-auction-gold to-yellow-600" />
            )}
            All categories
          </li>

          {categories.map((c) => (
            <li
              key={c.id}
              className={`cursor-pointer select-none py-2 pl-10 pr-4 hover:bg-gradient-to-br from-auction-gold to-yellow-600 hover:text-white ${
                selectedCategory === c.id ? "font-semibold" : "font-normal"
              }`}
              onClick={() => {
                setSelectedCategory(c.id);
                setDropdownOpen(false);
              }}
            >
              {selectedCategory === c.id && (
                <Check className="absolute left-3 top-2.5 h-5 w-5 text-indigo-600" />
              )}
              {c.name}
            </li>
          ))}
        </ul>
      )}
    </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleAuctions.map((auction) => {
            const category = auction.category ?? (auction.categoryId ? categoriesMap.get(auction.categoryId) ?? null : null);
            const endDate = toDate(auction.endTime);
            const isEnded = !endDate || endDate.getTime() <= Date.now();
            const currentPrice = auction.currentPrice ?? auction.startPrice ?? 0;
            const imageUrl = normalizeImage(auction.imageUrl) ?? undefined;

            return (
              <Card
                key={auction.id}
                className="group auction-gradient-card hover:auction-shadow-elegant auction-transition cursor-pointer overflow-hidden w-[450px] h-74"
              >
                <div className="relative">
                <img
                    src={normalizeImage(imageUrl) ?? ""}
                    alt={auction.title}
                    className="w-full h-64 object-cover group-hover:scale-105 auction-transition"/>
                    {/*<img src={imageUrl} alt={auction.title} className="w-full h-64 object-cover group-hover:scale-105 auction-transition" />*/}
                  

                  {/* Favorite Heart */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`absolute top-3 right-3 ${false ? "text-red-500" : "text-white"} bg-black/20 hover:bg-black/40`}
                    onClick={(e) => {
                      e.preventDefault();
                      // TODO: hook into wishlist state
                    }}
                  >
                    <Heart className={`h-5 w-5 ${false ? "fill-current" : ""}`} />
                  </Button>

                  {/* Live / Ended badge */}
                  {endDate && endDate.getTime() > Date.now() ? (
                    <Badge className="absolute top-3 left-3 bg-red-500 text-white animate-pulse">LIVE</Badge>
                  ) : (
                    <Badge className="absolute top-3 left-3 bg-gray-300 text-gray-700">Ended</Badge>
                  )}

                  {/* Category badge */}
                  <Badge className="absolute bottom-3 left-3 bg-auction-navy text-white">{category?.name ?? "Uncategorized"}</Badge>
                </div>

                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-auction-navy group-hover:text-auction-gold auction-transition line-clamp-1">
                        {auction.title}
                      </h3>
                      <p className="text-muted-foreground text-sm mt-1 line-clamp-2">{auction.description}</p>
                    </div>

                    {/* Price & bids */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Current Bid</span>
                        <span className="text-xl font-bold text-auction-gold">{formatPrice(currentPrice)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Starting: {formatPrice(auction.startPrice)}</span>
                        <div className="flex items-center space-x-1">
                          <Users className="h-4 w-4" />
                          <span>{auction.bidCount} bids</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {/* formatTimeRemaining uses the resilient toDate parser */}
                        <span>{formatTimeRemaining(auction.endTime)}</span>
                      </div>
                      <Link to={`/auctions/${auction.id}`}>
                        <Button variant="bid" size="sm" disabled={isEnded}>
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
            <div className="col-span-full text-center text-muted-foreground p-8 rounded bg-white shadow-sm">No auctions found.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuctionsPage;
