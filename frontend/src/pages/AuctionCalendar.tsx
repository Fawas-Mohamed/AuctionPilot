import { useState } from "react";
import { Calendar, Clock, MapPin, Users, ArrowLeft, ArrowRight, Filter } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const AuctionCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 11)); 
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [viewMode, setViewMode] = useState("grid");

  const auctions = [
    {
      id: 1,
      title: "Contemporary Art & Design",
      date: "2024-01-15",
      time: "14:00",
      endTime: "18:00",
      location: "Main Gallery",
      category: "Fine Art",
      status: "upcoming",
      lots: 45,
      estimate: "500K-800K",
      image: "/placeholder.svg",
      isLive: true,
      preview: "Jan 12-14"
    },
    {
      id: 2,
      title: "Vintage Jewelry & Watches",
      date: "2024-01-20",
      time: "10:00",
      endTime: "16:00",
      location: "Jewelry Salon",
      category: "Jewelry",
      status: "upcoming",
      lots: 120,
      estimate: "1.2M-1.8M",
      image: "/placeholder.svg",
      isLive: true,
      preview: "Jan 17-19"
    },
    {
      id: 3,
      title: "Asian Art & Antiquities",
      date: "2024-01-25",
      time: "11:00",
      endTime: "15:00",
      location: "East Wing",
      category: "Asian Art",
      status: "preview",
      lots: 85,
      estimate: "800K-1.2M",
      image: "/placeholder.svg",
      isLive: false,
      preview: "Jan 22-24"
    },
    {
      id: 4,
      title: "Modern & Contemporary",
      date: "2024-01-30",
      time: "19:00",
      endTime: "22:00",
      location: "Grand Hall",
      category: "Fine Art",
      status: "upcoming",
      lots: 65,
      estimate: "2M-3M",
      image: "/placeholder.svg",
      isLive: true,
      preview: "Jan 27-29"
    },
    {
      id: 5,
      title: "Rare Books & Manuscripts",
      date: "2024-02-05",
      time: "14:00",
      endTime: "17:00",
      location: "Library Room",
      category: "Books",
      status: "upcoming",
      lots: 200,
      estimate: "300K-500K",
      image: "/placeholder.svg",
      isLive: false,
      preview: "Feb 2-4"
    },
    {
      id: 6,
      title: "Decorative Arts & Furniture",
      date: "2024-02-10",
      time: "13:00",
      endTime: "18:00",
      location: "West Gallery",
      category: "Decorative Arts",
      status: "upcoming",
      lots: 150,
      estimate: "600K-900K",
      image: "/placeholder.svg",
      isLive: true,
      preview: "Feb 7-9"
    }
  ];

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "Fine Art", label: "Fine Art" },
    { value: "Jewelry", label: "Jewelry & Watches" },
    { value: "Asian Art", label: "Asian Art" },
    { value: "Books", label: "Books & Manuscripts" },
    { value: "Decorative Arts", label: "Decorative Arts" }
  ];

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const filteredAuctions = selectedCategory === "all" 
    ? auctions 
    : auctions.filter(auction => auction.category === selectedCategory);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "live": return "bg-red-100 text-red-800";
      case "upcoming": return "bg-blue-100 text-blue-800";
      case "preview": return "bg-yellow-100 text-yellow-800";
      case "completed": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(currentMonth.getMonth() + direction);
    setCurrentMonth(newDate);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold auction-gradient-text">Auction Calendar</h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Stay informed about upcoming auctions, preview exhibitions, and special events
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => navigateMonth(-1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
              <h2 className="text-2xl font-bold text-auction-navy">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h2>
              <Button variant="outline" onClick={() => navigateMonth(1)}>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
            
            <div className="flex items-center gap-4">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="flex gap-2">
                <Button 
                  variant={viewMode === "grid" ? "premium" : "outline"} 
                  size="sm"
                  onClick={() => setViewMode("grid")}
                >
                  Grid
                </Button>
                <Button 
                  variant={viewMode === "list" ? "premium" : "outline"} 
                  size="sm"
                  onClick={() => setViewMode("list")}
                >
                  List
                </Button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="auction-shadow-elegant">
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-auction-premium mb-2">
                  {filteredAuctions.filter(a => a.status === "upcoming").length}
                </div>
                <div className="text-sm text-muted-foreground">Upcoming Auctions</div>
              </CardContent>
            </Card>
            <Card className="auction-shadow-elegant">
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-auction-navy mb-2">
                  {filteredAuctions.reduce((sum, a) => sum + a.lots, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Total Lots</div>
              </CardContent>
            </Card>
            <Card className="auction-shadow-elegant">
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-auction-gold mb-2">
                  {filteredAuctions.filter(a => a.isLive).length}
                </div>
                <div className="text-sm text-muted-foreground">Live Online</div>
              </CardContent>
            </Card>
            <Card className="auction-shadow-elegant">
              <CardContent className="p-6 text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {filteredAuctions.filter(a => a.status === "preview").length}
                </div>
                <div className="text-sm text-muted-foreground">Preview Open</div>
              </CardContent>
            </Card>
          </div>

          {/* Auction Listings */}
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAuctions.map((auction) => (
                <Card key={auction.id} className="auction-shadow-elegant hover:scale-105 auction-transition">
                  <div className="relative">
                    <img
                      src={auction.image}
                      alt={auction.title}
                      className="w-full h-48 object-cover rounded-t-lg"
                    />
                    <div className="absolute top-4 left-4">
                      <Badge className={getStatusColor(auction.status)}>
                        {auction.status}
                      </Badge>
                    </div>
                    {auction.isLive && (
                      <div className="absolute top-4 right-4">
                        <Badge className="bg-red-500 text-white">
                          LIVE ONLINE
                        </Badge>
                      </div>
                    )}
                  </div>
                  
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <h3 className="text-xl font-bold text-auction-navy mb-2">{auction.title}</h3>
                      <Badge variant="outline">{auction.category}</Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        {new Date(auction.date).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {auction.time} - {auction.endTime}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        {auction.location}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="w-4 h-4" />
                        {auction.lots} lots
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t">
                      <div className="text-sm text-muted-foreground mb-1">Estimate</div>
                      <div className="text-lg font-bold text-auction-premium">${auction.estimate}</div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <Button variant="premium" className="w-full">
                        View Catalog
                      </Button>
                      <div className="text-xs text-center text-muted-foreground">
                        Preview: {auction.preview}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAuctions.map((auction) => (
                <Card key={auction.id} className="auction-shadow-elegant hover:scale-[1.02] auction-transition">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row gap-6">
                      <div className="w-full lg:w-48 h-32 lg:h-auto">
                        <img
                          src={auction.image}
                          alt={auction.title}
                          className="w-full h-full object-cover rounded-lg"
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
                              <Badge variant="outline">{auction.category}</Badge>
                              {auction.isLive && (
                                <Badge className="bg-red-500 text-white">LIVE ONLINE</Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Estimate</div>
                            <div className="text-xl font-bold text-auction-premium">${auction.estimate}</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-auction-premium" />
                            <div>
                              <div className="text-sm font-medium">{new Date(auction.date).toLocaleDateString()}</div>
                              <div className="text-xs text-muted-foreground">{auction.time}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-auction-premium" />
                            <div>
                              <div className="text-sm font-medium">{auction.location}</div>
                              <div className="text-xs text-muted-foreground">Venue</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-auction-premium" />
                            <div>
                              <div className="text-sm font-medium">{auction.lots} lots</div>
                              <div className="text-xs text-muted-foreground">Items</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-auction-premium" />
                            <div>
                              <div className="text-sm font-medium">Preview</div>
                              <div className="text-xs text-muted-foreground">{auction.preview}</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Button variant="premium" className="flex-1">
                            View Catalog
                          </Button>
                          <Button variant="outline" className="flex-1">
                            Set Reminder
                          </Button>
                          <Button variant="outline" className="flex-1">
                            Preview Schedule
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AuctionCalendar;