import { Link } from "react-router-dom";
import { Gavel, Mail, Phone, MapPin } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="
  bg-auction-navy text-white 
  dark:bg-gray-950
  text-gray-700 
  dark:text-gray-300
  border-t 
  border-gray-200 
  dark:border-gray-800
">

    
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center space-x-2">
              <Gavel className="h-8 w-8 text-auction-gold" />
              <span className="text-2xl font-bold">AuctionPilot</span>
            </Link>
            <p className="text-gray-300">
             Expertly curated auctions of fine art, antiques, and collectibles.
            </p>
            <div className="flex space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-300">
                <Mail className="h-4 w-4" />
                <span>AuctionPilot@gmail.com</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-auction-gold">Quick Links</h3>
            <div className="space-y-2">
              <Link to="/auctions" className="block text-gray-300 hover:text-auction-gold auction-transition">
                Browse Auctions
              </Link>
              <Link to="/sell" className="block text-gray-300 hover:text-auction-gold auction-transition">
                Sell with Us
              </Link>
              <Link to="/consignment" className="block text-gray-300 hover:text-auction-gold auction-transition">
                Consignment
              </Link>
              <Link to="/appraisals" className="block text-gray-300 hover:text-auction-gold auction-transition">
                Appraisals
              </Link>
            </div>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-auction-gold">Support</h3>
            <div className="space-y-2">
              <Link to="/help" className="block text-gray-300 hover:text-auction-gold auction-transition">
                Help Center
              </Link>
              <Link to="/bidding-guide" className="block text-gray-300 hover:text-auction-gold auction-transition">
                Bidding Guide
              </Link>
              <Link to="/terms" className="block text-gray-300 hover:text-auction-gold auction-transition">
                Terms of Service
              </Link>
              <Link to="/privacy" className="block text-gray-300 hover:text-auction-gold auction-transition">
                Privacy Policy
              </Link>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-auction-gold">Contact</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-gray-300">
                <Phone className="h-4 w-4" />
                <span>0778523520</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-300">
                <MapPin className="h-4 w-4" />
                <span>1,Kandy road<br />Colombo</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
          <p>&copy; 2025 AuctionPilot fawas. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};