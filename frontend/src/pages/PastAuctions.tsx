import { useState } from "react";
import { Search, Download, Eye, Calendar, TrendingUp, Award, DollarSign } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PastAuctions = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState("2024");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const pastAuctions = [
    {
      id: 1,
      title: "Modern & Contemporary Art",
      date: "2024-01-10",
      totalLots: 65,
      soldLots: 58,
      totalSales: 2850000,
      highestSale: 450000,
      category: "Fine Art",
      image: "/placeholder.svg",
      sellThroughRate: 89,
      topLot: "Abstract Composition by Maria Silva"
    },
    {
      id: 2,
      title: "Vintage Jewelry Collection",
      date: "2023-12-15",
      totalLots: 120,
      soldLots: 108,
      totalSales: 1680000,
      highestSale: 285000,
      category: "Jewelry",
      image: "/placeholder.svg",
      sellThroughRate: 90,
      topLot: "Art Deco Diamond Tiara"
    },
    {
      id: 3,
      title: "Asian Art & Antiquities",
      date: "2023-11-22",
      totalLots: 85,
      soldLots: 71,
      totalSales: 1450000,
      highestSale: 320000,
      category: "Asian Art",
      image: "/placeholder.svg",
      sellThroughRate: 84,
      topLot: "Ming Dynasty Porcelain Vase"
    },
    {
      id: 4,
      title: "Rare Books & Manuscripts",
      date: "2023-10-18",
      totalLots: 200,
      soldLots: 175,
      totalSales: 890000,
      highestSale: 125000,
      category: "Books",
      image: "/placeholder.svg",
      sellThroughRate: 88,
      topLot: "First Edition Shakespeare Folio"
    },
    {
      id: 5,
      title: "Decorative Arts Gala",
      date: "2023-09-25",
      totalLots: 150,
      soldLots: 132,
      totalSales: 1200000,
      highestSale: 180000,
      category: "Decorative Arts",
      image: "/placeholder.svg",
      sellThroughRate: 88,
      topLot: "Louis XVI Gilt Bronze Clock"
    },
    {
      id: 6,
      title: "Impressionist & Modern",
      date: "2023-08-30",
      totalLots: 45,
      soldLots: 42,
      totalSales: 3200000,
      highestSale: 680000,
      category: "Fine Art",
      image: "/placeholder.svg",
      sellThroughRate: 93,
      topLot: "Landscape by Claude Monet"
    }
  ];

  const years = ["2024", "2023", "2022", "2021", "2020"];
  const categories = [
    { value: "all", label: "All Categories" },
    { value: "Fine Art", label: "Fine Art" },
    { value: "Jewelry", label: "Jewelry & Watches" },
    { value: "Asian Art", label: "Asian Art" },
    { value: "Books", label: "Books & Manuscripts" },
    { value: "Decorative Arts", label: "Decorative Arts" }
  ];

  const filteredAuctions = pastAuctions.filter(auction => {
    const matchesSearch = auction.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         auction.topLot.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || auction.category === selectedCategory;
    const matchesYear = auction.date.startsWith(selectedYear);
    
    return matchesSearch && matchesCategory && matchesYear;
  });

  const totalStats = {
    totalSales: filteredAuctions.reduce((sum, auction) => sum + auction.totalSales, 0),
    totalLots: filteredAuctions.reduce((sum, auction) => sum + auction.totalLots, 0),
    soldLots: filteredAuctions.reduce((sum, auction) => sum + auction.soldLots, 0),
    avgSellThrough: Math.round(filteredAuctions.reduce((sum, auction) => sum + auction.sellThroughRate, 0) / filteredAuctions.length)
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold auction-gradient-text">Past Auctions Archive</h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Explore historical auction results, market trends, and notable sales from our archives
            </p>
          </div>

          {/* Search and Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search auctions or items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button variant="outline" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Export Results
            </Button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="auction-shadow-elegant">
              <CardContent className="p-6 text-center">
                <DollarSign className="w-8 h-8 mx-auto mb-2 text-auction-premium" />
                <div className="text-2xl font-bold text-auction-navy mb-1">
                  ${(totalStats.totalSales / 1000000).toFixed(1)}M
                </div>
                <div className="text-sm text-muted-foreground">Total Sales</div>
              </CardContent>
            </Card>
            
            <Card className="auction-shadow-elegant">
              <CardContent className="p-6 text-center">
                <Award className="w-8 h-8 mx-auto mb-2 text-auction-gold" />
                <div className="text-2xl font-bold text-auction-navy mb-1">
                  {totalStats.soldLots}/{totalStats.totalLots}
                </div>
                <div className="text-sm text-muted-foreground">Lots Sold</div>
              </CardContent>
            </Card>
            
            <Card className="auction-shadow-elegant">
              <CardContent className="p-6 text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold text-auction-navy mb-1">
                  {totalStats.avgSellThrough}%
                </div>
                <div className="text-sm text-muted-foreground">Avg Sell-Through</div>
              </CardContent>
            </Card>
            
            <Card className="auction-shadow-elegant">
              <CardContent className="p-6 text-center">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-auction-premium" />
                <div className="text-2xl font-bold text-auction-navy mb-1">
                  {filteredAuctions.length}
                </div>
                <div className="text-sm text-muted-foreground">Auctions</div>
              </CardContent>
            </Card>
          </div>

          {/* Auction Results */}
          <div className="space-y-6">
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
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{auction.category}</Badge>
                            <Badge className="bg-green-100 text-green-800">
                              {auction.sellThroughRate}% Sold
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {new Date(auction.date).toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </p>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Total Sales</div>
                          <div className="text-2xl font-bold text-auction-premium">
                            ${(auction.totalSales / 1000000).toFixed(1)}M
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div>
                          <div className="text-sm text-muted-foreground">Lots Offered</div>
                          <div className="text-lg font-bold text-auction-navy">{auction.totalLots}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Lots Sold</div>
                          <div className="text-lg font-bold text-green-600">{auction.soldLots}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Highest Sale</div>
                          <div className="text-lg font-bold text-auction-premium">
                            ${auction.highestSale.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Sell-Through Rate</div>
                          <div className="text-lg font-bold">{auction.sellThroughRate}%</div>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h4 className="font-medium text-auction-navy mb-1">Top Lot</h4>
                        <p className="text-sm text-muted-foreground">{auction.topLot}</p>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button variant="premium" className="flex-1">
                          <Eye className="w-4 h-4 mr-2" />
                          View Results
                        </Button>
                        <Button variant="outline" className="flex-1">
                          <Download className="w-4 h-4 mr-2" />
                          Download Catalog
                        </Button>
                        <Button variant="outline" className="flex-1">
                          Price Analysis
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredAuctions.length === 0 && (
            <Card className="auction-shadow-elegant">
              <CardContent className="p-12 text-center">
                <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-bold text-auction-navy mb-2">No Results Found</h3>
                <p className="text-muted-foreground mb-6">
                  Try adjusting your search criteria or browse different categories
                </p>
                <Button variant="premium" onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("all");
                }}>
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Market Insights */}
          <Card className="auction-shadow-elegant">
            <CardHeader>
              <CardTitle className="text-2xl text-auction-navy">Market Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-6 bg-muted/30 rounded-lg">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-600" />
                  <h3 className="font-bold text-auction-navy mb-2">Market Trend</h3>
                  <p className="text-sm text-muted-foreground">
                    Contemporary art sales increased 15% year-over-year
                  </p>
                </div>
                <div className="text-center p-6 bg-muted/30 rounded-lg">
                  <Award className="w-8 h-8 mx-auto mb-2 text-auction-gold" />
                  <h3 className="font-bold text-auction-navy mb-2">Record Breaking</h3>
                  <p className="text-sm text-muted-foreground">
                    3 new artist records established this season
                  </p>
                </div>
                <div className="text-center p-6 bg-muted/30 rounded-lg">
                  <DollarSign className="w-8 h-8 mx-auto mb-2 text-auction-premium" />
                  <h3 className="font-bold text-auction-navy mb-2">Strong Performance</h3>
                  <p className="text-sm text-muted-foreground">
                    Average sell-through rate of 88% across all categories
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PastAuctions;