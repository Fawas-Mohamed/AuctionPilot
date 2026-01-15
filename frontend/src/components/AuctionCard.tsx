import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Clock, Users } from "lucide-react";
import { Link } from "react-router-dom";

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

interface AuctionCardProps {
  item: AuctionItem;
}

export const AuctionCard = ({ item }: AuctionCardProps) => {
  const [isFavorited, setIsFavorited] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
    }).format(price);
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

  return (
    <Card className="group auction-gradient-card hover:auction-shadow-elegant auction-transition cursor-pointer overflow-hidden">
      <div className="relative">
        <img
          src={item.image}
          alt={item.title}
          className="w-full h-64 object-cover group-hover:scale-105 auction-transition"
        />
        <Button
          variant="ghost"
          size="icon"
          className={`absolute top-3 right-3 ${
            isFavorited ? "text-red-500" : "text-white"
          } bg-black/20 hover:bg-black/40`}
          onClick={(e) => {
            e.preventDefault();
            setIsFavorited(!isFavorited);
          }}
        >
          <Heart className={`h-5 w-5 ${isFavorited ? "fill-current" : ""}`} />
        </Button>
        {item.isLive && (
          <Badge className="absolute top-3 left-3 bg-red-500 text-white animate-pulse">
            LIVE
          </Badge>
        )}
        <Badge className="absolute bottom-3 left-3 bg-auction-navy text-white">
          {item.category}
        </Badge>
      </div>
      
      <CardContent className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-auction-navy group-hover:text-auction-gold auction-transition line-clamp-1">
              {item.title}
            </h3>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Current Bid</span>
              <span className="text-xl font-bold text-auction-gold">
                {formatPrice(item.currentBid)}
              </span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Starting: {formatPrice(item.startingBid)}</span>
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4" />
                <span>{item.bidCount} bids</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center space-x-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{formatTimeRemaining(item.endTime)}</span>
            </div>
            <Link to={`/auction/${item.id}`}>
              <Button variant="bid" size="sm">
                Place Bid
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};