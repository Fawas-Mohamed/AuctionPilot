import { useState } from "react";
import { Clock, TrendingUp, AlertCircle, CheckCircle, X } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MyBids = () => {
  const [filter, setFilter] = useState("all");

  const bids = [
    {
      id: 1,
      title: "Vintage Rolex Submariner",
      currentBid: 15800,
      myBid: 15800,
      nextMinBid: 16000,
      endTime: "2024-01-20T15:30:00",
      status: "winning",
      image: "/placeholder.svg",
      totalBids: 23
    },
    {
      id: 2,
      title: "Contemporary Abstract Painting",
      currentBid: 8500,
      myBid: 8000,
      nextMinBid: 8750,
      endTime: "2024-01-21T18:00:00",
      status: "outbid",
      image: "/placeholder.svg",
      totalBids: 18
    },
    {
      id: 3,
      title: "Art Deco Diamond Necklace",
      currentBid: 12500,
      myBid: 12500,
      nextMinBid: 13000,
      endTime: "2024-01-19T12:00:00",
      status: "ended",
      image: "/placeholder.svg",
      totalBids: 31,
      won: true
    },
    {
      id: 4,
      title: "Ming Dynasty Vase",
      currentBid: 25000,
      myBid: 24000,
      nextMinBid: 25500,
      endTime: "2024-01-22T20:00:00",
      status: "outbid",
      image: "/placeholder.svg",
      totalBids: 15
    }
  ];

  const getStatusColor = (status: string, won?: boolean) => {
    if (status === "ended" && won) return "bg-green-100 text-green-800";
    if (status === "ended" && !won) return "bg-red-100 text-red-800";
    if (status === "winning") return "bg-green-100 text-green-800";
    if (status === "outbid") return "bg-yellow-100 text-yellow-800";
    return "bg-gray-100 text-gray-800";
  };

  const getStatusIcon = (status: string, won?: boolean) => {
    if (status === "ended" && won) return <CheckCircle className="w-4 h-4" />;
    if (status === "ended" && !won) return <X className="w-4 h-4" />;
    if (status === "winning") return <TrendingUp className="w-4 h-4" />;
    if (status === "outbid") return <AlertCircle className="w-4 h-4" />;
    return <Clock className="w-4 h-4" />;
  };

  const formatTimeRemaining = (endTime: string) => {
    const end = new Date(endTime);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return "Ended";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const filteredBids = bids.filter(bid => {
    if (filter === "active") return bid.status !== "ended";
    if (filter === "won") return bid.status === "ended" && bid.won;
    if (filter === "lost") return bid.status === "ended" && !bid.won;
    return true;
  });

  const stats = [
    { label: "Active Bids", value: bids.filter(b => b.status !== "ended").length },
    { label: "Won Auctions", value: bids.filter(b => b.won).length },
    { label: "Total Bids", value: bids.length },
    { label: "Success Rate", value: `${Math.round((bids.filter(b => b.won).length / bids.filter(b => b.status === "ended").length) * 100) || 0}%` }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold auction-gradient-text">My Bids</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Track your bidding activity and manage your auction participation
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <Card key={index} className="auction-shadow-elegant">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-auction-premium mb-2">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all" onClick={() => setFilter("all")}>
                All Bids
              </TabsTrigger>
              <TabsTrigger value="active" onClick={() => setFilter("active")}>
                Active
              </TabsTrigger>
              <TabsTrigger value="won" onClick={() => setFilter("won")}>
                Won
              </TabsTrigger>
              <TabsTrigger value="lost" onClick={() => setFilter("lost")}>
                Lost
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-8">
              <div className="grid gap-6">
                {filteredBids.map((bid) => (
                  <Card key={bid.id} className="auction-shadow-elegant hover:scale-[1.02] auction-transition">
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row gap-6">
                        <div className="w-full lg:w-48 h-32 lg:h-auto">
                          <img
                            src={bid.image}
                            alt={bid.title}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        </div>
                        
                        <div className="flex-1 space-y-4">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div>
                              <h3 className="text-xl font-bold text-auction-navy mb-2">{bid.title}</h3>
                              <div className="flex items-center gap-2">
                                <Badge className={getStatusColor(bid.status, bid.won)}>
                                  {getStatusIcon(bid.status, bid.won)}
                                  {bid.status === "ended" && bid.won ? "Won" : 
                                   bid.status === "ended" && !bid.won ? "Lost" :
                                   bid.status === "winning" ? "Winning" : "Outbid"}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {bid.totalBids} bids
                                </span>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">Time Remaining</div>
                              <div className="text-lg font-bold text-auction-premium">
                                {formatTimeRemaining(bid.endTime)}
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <div className="text-sm text-muted-foreground">Current Bid</div>
                              <div className="text-xl font-bold text-auction-navy">
                                ${bid.currentBid.toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">My Bid</div>
                              <div className="text-xl font-bold text-auction-premium">
                                ${bid.myBid.toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">Next Min Bid</div>
                              <div className="text-xl font-bold">
                                ${bid.nextMinBid.toLocaleString()}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row gap-3">
                            <Button variant="premium" className="flex-1">
                              View Auction
                            </Button>
                            {bid.status !== "ended" && (
                              <Button variant="outline" className="flex-1">
                                {bid.status === "outbid" ? "Increase Bid" : "Update Bid"}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default MyBids;