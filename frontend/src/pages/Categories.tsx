import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const categories = [
  {
    id: 1,
    name: "Fine Art",
    description: "Paintings, sculptures, and contemporary art pieces",
    itemCount: 234,
    image: "/src/assets/painting-auction.jpg",
    featured: true
  },
  {
    id: 2,
    name: "Jewelry & Watches",
    description: "Luxury timepieces, diamond jewelry, and precious stones",
    itemCount: 156,
    image: "/src/assets/jewelry-auction.jpg",
    featured: true
  },
  {
    id: 3,
    name: "Collectibles",
    description: "Rare coins, stamps, vintage toys, and memorabilia",
    itemCount: 89,
    image: "/src/assets/watch-auction.jpg",
    featured: false
  },
  {
    id: 4,
    name: "Antiques",
    description: "Furniture, ceramics, glassware, and historical artifacts",
    itemCount: 167,
    image: "/src/assets/auction-hero.jpg",
    featured: false
  },
  {
    id: 5,
    name: "Wine & Spirits",
    description: "Vintage wines, rare whiskeys, and premium spirits",
    itemCount: 78,
    image: "/src/assets/painting-auction.jpg",
    featured: false
  },
  {
    id: 6,
    name: "Sports Memorabilia",
    description: "Autographed items, vintage equipment, and trading cards",
    itemCount: 134,
    image: "/src/assets/jewelry-auction.jpg",
    featured: false
  }
];

export default function Categories() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">Auction Categories</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Discover exceptional items across our curated categories
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {categories.map((category) => (
            <Card key={category.id} className="group hover:shadow-elegant transition-all duration-300 overflow-hidden">
              <div className="relative h-48 overflow-hidden">
                <img 
                  src={category.image} 
                  alt={category.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {category.featured && (
                  <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground">
                    Featured
                  </Badge>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-4 left-4 text-white">
                  <h3 className="text-xl font-semibold">{category.name}</h3>
                </div>
              </div>
              
              <CardContent className="p-6">
                <p className="text-muted-foreground mb-4">{category.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {category.itemCount} items
                  </span>
                  <Button variant="outline" asChild>
                    <Link to={`/auctions?category=${category.name.toLowerCase().replace(/\s+/g, '-')}`}>
                      Browse Items
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}