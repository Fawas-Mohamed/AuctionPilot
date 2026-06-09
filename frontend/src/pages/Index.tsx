import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AuctionCard } from "@/components/AuctionCard";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Gavel, TrendingUp, Shield, Clock, Star, ArrowRight } from "lucide-react";
import auctionHero from "@/assets/auction-hero.jpg";
import watchAuction from "@/assets/watch-auction.jpg";
import paintingAuction from "@/assets/painting-auction.jpg";
import jewelryAuction from "@/assets/jewelry-auction.jpg";
import { Link } from 'react-router-dom';
import { useState, useEffect } from "react";
import { Category } from "@/lib/useCategories";
import axios from "axios";
import Auctions from "./Auctions";
import { formatServerUtc, parseServerUtcToDate } from "@/utils/formatServerUtc";
import api from "@/lib/api";

// backend response type
interface Auction {
  id: number;
  title: string;
  description: string;
  imageUrl?: string;
  startPrice: number;
  currentPrice: number;
  endTime: string;
  bidcount: number;
  category?: {
    name: string;
  };
  status
}
interface AuctionItem {
  id: string;
  title: string;
  description: string;
  image: string;
  currentBid: number;
  startingBid: number;
  endTime: string;
  category: string;
  bidCount: number;
  isLive?: boolean;
}


const Index = () => {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState();
  
  const apiBase = (
  import.meta.env.VITE_API_URL ??
  "https://localhost:62628"
).replace(/\/api$/, "").replace(/\/$/, "");
  const signalRUrl = import.meta.env.VITE_SIGNALR_URL ?? `${apiBase.replace(/\/api$|\/$/, "")}/hubs/auction`;

  // helper: normalize image URL (if relative -> prefix with API base)
   const normalizeImage = (imageUrl: string | null | undefined) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith("http")) return imageUrl;
    return `https://localhost:62628${imageUrl}`;
  };



  const fetchAuctions = async () => {
    try{
      const res = await api.get("/Auctions/latest");
      setAuctions(res.data ?? []);
    }catch(err){
      console.error("Failed to load auctions", err);
    }
  }
  useEffect(() => {
      void fetchAuctions();
    }, []);

    const formatPrice = (p?: number) =>
      typeof p === "number" ? new Intl.NumberFormat("en-LK", { style: "currency", currency:"LKR"}).format(p) : "-";

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
            prev.map((a) => (a.id === auctionId ? { ...a, currentPrice: newPrice ?? a.currentPrice, bidCount: bidCount ?? a.bidcount } : a))
          );
        }
        return;
      }

      if (args.length >= 3) {
        const [auctionId, newPrice, bidCount] = args;
        setAuctions((prev) =>
          prev.map((a) => (a.id === auctionId ? { ...a, currentPrice: newPrice ?? a.currentPrice, bidCount: bidCount ?? a.bidcount } : a))
        );
        return;
      }

      // unknown shape -> refresh list
      void fetchAuctions();
    };
  const featuredAuctions = [
    {
      id: "1",
      title: "Vintage Rolex Submariner 1970",
      description: "Rare vintage watch in excellent condition with original papers and box",
      image: watchAuction,
      currentBid: 15750,
      startingBid: 8000,
      endTime: "2024-01-20T18:00:00Z",
      category: "Watches",
      bidCount: 23,
      isLive: true,
    },
    {
      id: "2",
      title: "Claude Monet - Water Lilies Study",
      description: "Original oil painting from the artist's personal collection",
      image: paintingAuction,
      currentBid: 425000,
      startingBid: 200000,
      endTime: "2024-01-22T20:00:00Z",
      category: "Fine Art",
      bidCount: 67,
    },
    {
      id: "3",
      title: "Art Deco Diamond Necklace",
      description: "Stunning 1920s diamond and platinum necklace with provenance",
      image: jewelryAuction,
      currentBid: 85000,
      startingBid: 45000,
      endTime: "2024-01-25T19:00:00Z",
      category: "Jewelry",
      bidCount: 41,
    },
  ];

  const categories = [
    { name: "Fine Art", count: 1247, icon: "🎨" },
    { name: "Jewelry", count: 892, icon: "💎" },
    { name: "Watches", count: 634, icon: "⌚" },
    { name: "Antiques", count: 1156, icon: "🏺" },
    { name: "Collectibles", count: 723, icon: "🎭" },
    { name: "Furniture", count: 445, icon: "🪑" },
  ];

  return (
   
    <div className="min-h-screen bg-background">
     
      {/* Hero Section */}
 <section className="relative min-h-[85vh] flex items-center overflow-hidden">
  {/* Background */}
  <div className="absolute inset-0 bg-gradient-to-br from-[#0b1220] via-[#111827] to-black" />

  <div className="relative z-10 mx-auto max-w-7xl px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
    
    {/* LEFT — Text */}
    <div className="text-white space-y-8">
      <h1 className="text-3xl md:text-6xl font-extrabold leading-tight animate-fade-left">
        Bid Smart  Win Big
        <span className="block bg-gradient-to-r from-auction-gold to-yellow-300 bg-clip-text text-transparent">
          Trade with Confidence.
        </span>
      </h1>
      

      <p className="text-base md:text-xl text-gray-300 max-w-xl animate-fade-left delay-150">
  Discover live auctions, rare collectibles, and exclusive deals — all in one secure, real-time bidding platform.
</p>

<div className="flex flex-wrap gap-8 mt-4 animate-fade-left delay-200">
  <div className="flex items-center gap-3">
    <span className="text-auction-gold text-xl">⏱️</span>
    <span className="text-gray-200 font-semibold">Real-time Bidding</span>
  </div>
  <div className="flex items-center gap-3">
    <span className="text-auction-gold text-xl">✔️</span>
    <span className="text-gray-200 font-semibold">Verified Sellers</span>
  </div>
  <div className="flex items-center gap-3">
    <span className="text-auction-gold text-xl">📡</span>
    <span className="text-gray-200 font-semibold">Live Updates</span>
  </div>
</div>


      <div className="flex flex-col sm:flex-row gap-4 animate-fade-left delay-300">
        <Link to="/auctions">
          <Button
            size="lg"
            className="
              px-8 py-6 text-lg font-semibold
              rounded-full
              bg-auction-gold text-auction-navy
              shadow-xl hover:shadow-2xl
              hover:scale-105 transition
            "
          >
            Browse Auctions
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>

        <Link to="/about">
          <Button
            size="lg"
            variant="outline"
            className="
              px-8 py-6 text-lg font-semibold
              rounded-full
              border-white/40 text-white
              backdrop-blur-md bg-white/10
              hover:bg-white/20 hover:scale-105 transition
            "
          >
            About Us
          </Button>
        </Link>
      </div>
    </div>

    {/* RIGHT — Image */}
    <div className="relative animate-fade-right">
      <div className="absolute -inset-6 bg-auction-gold/20 blur-3xl rounded-full" />
      <img
        src={auctionHero}
        alt="Auction showcase"
        className="
          relative w-full max-w-xl mx-auto
          rounded-3xl shadow-2xl
          object-cover
        "
      />
    </div>

  </div>
</section>



      {/* Featured Auctions */}
      <section className="py-16 bg-gradient-to-b from-background to-secondary/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-auction-navy mb-4">Featured Auctions</h2>
            <p className="text-xl text-muted-foreground">Exceptional pieces currently accepting bids</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {auctions.map((a) => {
  const item: AuctionItem = {
    id: String(a.id),
    title: a.title,
    description: a.description,
    image: normalizeImage(a.imageUrl ),
    currentBid: a.currentPrice,
    startingBid: a.startPrice,
    endTime: a.endTime,
    category: a.category?.name ?? "General",
    bidCount: a.bidcount,
    isLive : a.status,
  };

  return <AuctionCard key={a.id} item={item} />;
})}

          </div>
          <div className="text-center mt-12">
            <Link to="/auctionpage">
              <Button variant="gold" size="lg">
                View All Auctions
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    
      {/* Categories */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-auction-navy mb-4">Browse by Category</h2>
            <p className="text-xl text-muted-foreground">Explore what fascinates you</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {categories.map((category) => {
            // Create a URL-friendly slug: lowercase, replace spaces with dashes
            const slug = encodeURIComponent(category.name.toLowerCase().replace(/\s+/g, "-"));
            return (
            <Link key={category.name} to={`/categories/${slug}`} className="group">
              <div className="bg-card hover:auction-shadow-elegant auction-transition rounded-lg p-6 text-center border hover:border-auction-gold">
                <div className="text-4xl mb-3">{category.icon}</div>
                <h3 className="font-semibold text-auction-navy group-hover:text-auction-gold auction-transition">
                  {category.name}
                </h3>
                {/*<p className="text-sm text-muted-foreground mt-1">{category.count} items</p>*/}
              </div>
            </Link>
            );
            })}
          </div>
        </div>
      </section>
      
      {/* Features */}
      <section className="py-16 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-auction-navy mb-4">Why Choose AuctionHouse</h2>
            <p className="text-xl text-muted-foreground">Trusted by collectors worldwide</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center group">
              <div className="auction-gradient-gold w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 auction-spring">
                <Shield className="h-8 w-8 text-auction-navy" />
              </div>
              <h3 className="text-xl font-semibold text-auction-navy mb-3">Authenticated Items</h3>
              <p className="text-muted-foreground">
                Every item is expertly authenticated and comes with detailed provenance documentation.
              </p>
            </div>
            
            <div className="text-center group">
              <div className="auction-gradient-gold w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 auction-spring">
                <Clock className="h-8 w-8 text-auction-navy" />
              </div>
              <h3 className="text-xl font-semibold text-auction-navy mb-3">Live Bidding</h3>
              <p className="text-muted-foreground">
                Participate in real-time auctions from anywhere in the world with our live bidding platform.
              </p>
            </div>
            
            <div className="text-center group">
              <div className="auction-gradient-gold w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 auction-spring">
                <Star className="h-8 w-8 text-auction-navy" />
              </div>
              <h3 className="text-xl font-semibold text-auction-navy mb-3">Expert Curation</h3>
              <p className="text-muted-foreground">
                Our team of specialists carefully curates each auction to ensure the highest quality offerings.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
 
  );
  
};
export default Index;
