import React, { useState , useEffect} from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { startHub } from "@/lib/signalr";
import { Sun, Moon } from "lucide-react";
import NotificationBell from "./NotificationBell";
import {
  Gavel,
  Search,
  User as UserIcon,
  Heart,
  ShoppingBag,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { CreateAuctionButton } from "@/components/CreateAuctionButton";

type HeaderProps = {
  children?: React.ReactNode; // allow passing e.g. <NotificationBell />
};

export const Header: React.FC<HeaderProps> = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [theme, setTheme] = useState("");

  
  const location = useLocation();
  const { user, loading, logout } = useAuth();
  const isActive = (path: string) => location.pathname === path;
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
type MenuItemProps = {
  to: string;
  label: string;
  highlight?: boolean;
};

function MenuItem({ to, label, highlight = false }: MenuItemProps) {
  return (
    <Link
      to={to}
      className={`block px-3 py-2 text-sm rounded-lg transition
        ${
          highlight
            ? "bg-muted/40 font-semibold"
            : "hover:bg-muted/30"
        }`}
    >
      {label}
    </Link>
  );
}
 
useEffect(() => {
  const handleClick = () => {
    setIsMenuOpen(false);
    setIsNotifOpen(false);
  };

  document.addEventListener("click", handleClick);
  return () => document.removeEventListener("click", handleClick);
}, []);
  
    // 🔔 Start SignalR connection when user is logged in
    useEffect(() => {
      if (!token) return;
  
      startHub(() => token, {
        NotificationCreated: (payload: any) => {
          console.log("🔔 Notification received:", payload);
        },
        AuctionClosed: (payload: any) => {
          console.log("🏁 Auction closed:", payload);
        },
      });
    }, [token]);
    const toggleTheme = () => {
  const next = theme === "dark" ? "light" : "dark";
  setTheme(next);
  localStorage.setItem("theme", next);
};
useEffect(() => {
  document.documentElement.classList.toggle("dark", theme === "dark");
}, [theme]);



  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="bg-white dark:bg-gray-900 text-black dark:text-white">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <Gavel className="h-8 w-8 text-auction-gold" />
            <span className="text-2xl font-bold text-auction-navy">AuctionPilot</span>
          </Link>
            
          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              to="/"
              className={`auction-transition hover:text-auction-gold ${
                isActive("/") ? "text-auction-gold font-semibold" : "text-foreground"
              }`}
            >
              Home
            </Link>
            <Link
              to="/hii"
              className={`auction-transition hover:text-auction-gold ${
                isActive("/hii") ? "text-auction-gold font-semibold" : "text-foreground"
              }`}
            >
              Auctions
            </Link>
            <Link
              to="/categery"
              className={`auction-transition hover:text-auction-gold ${
                isActive("/categories") ? "text-auction-gold font-semibold" : "text-foreground"
              }`}
            >
              Categories
            </Link>
            <Link
              to="/auctions"
              className={`auction-transition hover:text-auction-gold ${
                isActive("/auctions") ? "text-auction-gold font-semibold" : "text-foreground"
              }`}
            >
              Browse Auctions
            </Link>
            <Link
              to="/how-it-works"
              className={`auction-transition hover:text-auction-gold ${
                isActive("/how-it-works") ? "text-auction-gold font-semibold" : "text-foreground"
              }`}
            >
              How It Works
            </Link>
          </nav>
          

          {/* Right side actions */}
          <div className="flex items-center space-x-4">     
            <Button variant="ghost" size="icon" asChild>
              <button aria-label="Search">
                <Search className="h-5 w-5" />
              </button>
            </Button>

            <Link to="/watchlist">
              <Button variant="ghost" size="icon" asChild>
                <button aria-label="Favorites">
                  <Heart className="h-5 w-5" />
                </button>
              </Button>  
            </Link>
            <div onClick={(e) => e.stopPropagation()}className="relative">
            <NotificationBell getToken={() => token}
  open={isNotifOpen}
  onToggle={() => {
    setIsNotifOpen(o => !o);
    setIsMenuOpen(false); // 👈 close mobile menu
  }}
  onClose={() => setIsNotifOpen(false)}
/></div>

            {/* Auth area */}
           {!loading && user ? (
  <div
    className="relative"
    onClick={(e) => e.stopPropagation()}
  >
    {/* Profile Button */}
    <button
      onClick={() => {
        setIsMenuOpen((o) => !o);
        setIsNotifOpen(false);
      }}
      aria-expanded={isMenuOpen}
      aria-haspopup="true"
      className="flex items-center gap-2 px-2 py-1.5 rounded-full hover:bg-muted/50 transition"
    >
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-auction-gold to-yellow-600 text-white flex items-center justify-center font-semibold">
        {user.displayName?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
      </div>

      <span className="hidden sm:block text-sm font-medium max-w-[120px] truncate">
        {user.displayName ?? user.email}
      </span>

      <ChevronDown
        className={`w-4 h-4 transition-transform ${
          isMenuOpen ? "rotate-180" : ""
        }`}
      />
    </button>

    {/* Dropdown */}
    {isMenuOpen && (
      <div className="absolute right-0 mt-3 w-64 rounded-xl border bg-white shadow-lg backdrop-blur z-50 overflow-hidden">
        
        {/* User Info */}
        <div className="px-4 py-3 border-b">
          <p className="text-sm font-semibold truncate">
            {user.displayName ?? "User"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {user.email}
          </p>
        </div>

        {/* Menu */}
        <div className="p-2 space-y-1">
          <MenuItem to="/profile" label="Profile" />
          <MenuItem to="/my-bids" label="My Bids" />
          <MenuItem to="/my-auctions" label="My Auctions" />
          <MenuItem to="/settings" label="Settings" />

          {user.roles?.includes("Admin") && (
            <MenuItem
              to="/dashboard"
              label="Admin Dashboard"
              highlight
            />
          )}
        </div>

        {/* Logout */}
        <div className="border-t p-2">
          <button
            onClick={() => {
              setIsMenuOpen(false);
              logout();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm rounded-lg text-red-600 hover:bg-red-50 transition"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    )}
  </div>


            ) : (
              <>
           
                <Link to="/login">
                  <Button variant="gold" className="hidden sm:inline">Start Bidding</Button>
                </Link>
        





              </>
            )}
            <button
  onClick={toggleTheme}
  className="
    p-2 rounded-full
    hover:bg-gray-300 dark:hover:bg-gray-700
    transition-all duration-300
  "
  aria-label="Toggle theme"
>
  <Sun className="h-5 w-5 text-yellow-500 dark:hidden" />
  <Moon className="h-5 w-5 text-gray-200 hidden dark:block" />
</button>
          </div>
        </div>
      </div>
      </div>
    </header>
  );
};
