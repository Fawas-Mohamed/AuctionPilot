import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogDescription, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { SheetContent } from "@/components/ui/sheet";
import { Gavel, Search, Heart, LogOut, ChevronDown, Menu, Sun, Moon } from "lucide-react";
import NotificationBell from "./NotificationBell";
import { useAuth } from "@/contexts/AuthContext";

const navigationLinks = [
  { to: "/", label: "Home" },
  { to: "/auctionpage", label: "Auctions" },
  { to: "/categery", label: "Categories" },
  { to: "/auctions", label: "Browse Auctions" },
  { to: "/how-it-works", label: "How It Works" },
];
const accountLinks = [
  { to: "/profile", label: "Profile" },
  { to: "/my-bids", label: "My Bids" },
  { to: "/my-auctions", label: "My Auctions" },
  { to: "/settings", label: "Settings" },
];

type HeaderProps = { children?: React.ReactNode };

export const Header: React.FC<HeaderProps> = ({ children }) => {
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") ?? "");
  const location = useLocation();
  const { user, loading, logout } = useAuth();
  const token = localStorage.getItem("token");

  useEffect(() => {
    const closePopovers = () => {
      setIsAccountOpen(false);
      setIsNotifOpen(false);
    };
    document.addEventListener("click", closePopovers);
    return () => document.removeEventListener("click", closePopovers);
  }, []);

  useEffect(() => {
    setIsMobileOpen(false);
    setIsAccountOpen(false);
    setIsNotifOpen(false);
  }, [location.key]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1280px)");
    const closeOnDesktop = () => { if (desktop.matches) setIsMobileOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
  };
  const closeMobile = () => {
    setIsMobileOpen(false);
    setIsNotifOpen(false);
  };
  const navClass = (to: string) =>
    `auction-transition hover:text-auction-gold ${location.pathname === to ? "text-auction-gold font-semibold" : "text-foreground"}`;
  const accountItems = (onSelect: () => void) => (
    <>
      {accountLinks.map(({ to, label }) => (
        <Link key={to} to={to} onClick={onSelect}
          className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm hover:bg-muted/30">
          {label}
        </Link>
      ))}
      {user?.roles?.includes("Admin") && (
        <Link to="/dashboard" onClick={onSelect}
          className="flex min-h-11 items-center rounded-lg bg-muted/40 px-3 py-2 text-sm font-semibold">
          Admin Dashboard
        </Link>
      )}
      <button type="button" onClick={() => { onSelect(); logout(); }}
        className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50">
        <LogOut className="h-4 w-4" /> Logout
      </button>
    </>
  );
  const themeButton = (
    <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme"
      className="h-11 w-11 shrink-0 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700">
      <Sun className="h-5 w-5 text-yellow-500 dark:hidden" />
      <Moon className="hidden h-5 w-5 text-gray-200 dark:block" />
    </Button>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="bg-white text-black dark:bg-gray-900 dark:text-white">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between gap-3">
            <Link to="/" className="flex min-h-11 shrink-0 items-center gap-2">
              <Gavel className="h-8 w-8 shrink-0 text-auction-gold" />
              <span className="text-xl font-bold text-auction-navy sm:text-2xl">AuctionPilot</span>
            </Link>
            <nav aria-label="Main navigation" className="hidden items-center space-x-8 xl:flex">
              {navigationLinks.map(({ to, label }) => (
                <Link key={to} to={to} className={navClass(to)}
                  aria-current={location.pathname === to ? "page" : undefined}>{label}</Link>
              ))}
            </nav>
            <div className="flex shrink-0 items-center gap-4">
              <div className="hidden items-center gap-4 xl:flex">
                <Button variant="ghost" size="icon" aria-label="Search">
                  <Search className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" asChild>
                  <Link to="/watchlist" aria-label="Favorites"><Heart className="h-5 w-5" /></Link>
                </Button>
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <NotificationBell getToken={() => token} open={isNotifOpen}
                    onToggle={() => { setIsNotifOpen(o => !o); setIsAccountOpen(false); }}
                    onClose={() => setIsNotifOpen(false)} />
                </div>
                {!loading && user ? (
                  <div className="relative" onClick={e => e.stopPropagation()}>
                    <button type="button" aria-label="Account menu" aria-expanded={isAccountOpen}
                      aria-controls="account-navigation"
                      onClick={() => { setIsAccountOpen(o => !o); setIsNotifOpen(false); }}
                      className="flex min-h-11 items-center gap-2 rounded-full px-2 py-1.5 transition hover:bg-muted/50">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-auction-gold to-yellow-600 font-semibold text-white">
                        {user.displayName?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
                      </div>
                      <span className="max-w-[120px] truncate text-sm font-medium">{user.displayName ?? user.email}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isAccountOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isAccountOpen && (
                      <div id="account-navigation" className="absolute right-0 z-50 mt-3 w-64 rounded-xl border bg-white shadow-lg">
                        <div className="border-b px-4 py-3">
                          <p className="truncate text-sm font-semibold">{user.displayName ?? "User"}</p>
                          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <nav aria-label="Account navigation" className="space-y-1 p-2">
                          {accountItems(() => setIsAccountOpen(false))}
                        </nav>
                      </div>
                    )}
                  </div>
                ) : (
                  <Button variant="gold" asChild><Link to="/login">Start Bidding</Link></Button>
                )}
                {themeButton}
                {children}
              </div>

              <Dialog open={isMobileOpen} onOpenChange={open => {
                setIsMobileOpen(open);
                setIsAccountOpen(false);
                setIsNotifOpen(false);
              }}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open navigation menu"
                    className="h-11 w-11 xl:hidden [&_svg]:size-6">
                    <Menu className="h-6 w-6" strokeWidth={3} aria-hidden="true" />
                  </Button>
                </DialogTrigger>
                <SheetContent>
                  <div className="shrink-0 border-b px-5 py-6 pr-16">
                    <DialogTitle>Navigation</DialogTitle>
                    <DialogDescription className="sr-only">Browse auctions and access your account.</DialogDescription>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                    <nav aria-label="Mobile navigation" className="space-y-1">
                      {navigationLinks.map(({ to, label }) => (
                        <Link key={to} to={to} onClick={closeMobile}
                          aria-current={location.pathname === to ? "page" : undefined}
                          className={`flex min-h-11 items-center rounded-lg px-3 py-2 hover:bg-muted/30 ${navClass(to)}`}>{label}</Link>
                      ))}
                      <Link to="/watchlist" onClick={closeMobile}
                        className="flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 hover:bg-muted/30">
                        <Heart className="h-4 w-4" /> Favorites
                      </Link>
                    </nav>
                    <div className="mt-4 border-t pt-4">
                      {loading ? <p role="status" className="px-3 py-2 text-sm">Loading account...</p> : user ? (
                        <>
                          <div className="px-3 pb-3 [overflow-wrap:anywhere]">
                            <p className="font-semibold">{user.displayName ?? "User"}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                          <nav aria-label="Mobile account navigation" className="space-y-1">{accountItems(closeMobile)}</nav>
                        </>
                      ) : (
                        <div className="space-y-3">
                          <Button variant="gold" className="min-h-11 w-full" asChild>
                            <Link to="/login" onClick={closeMobile}>Login</Link>
                          </Button>
                          <Button variant="outline" className="min-h-11 w-full" asChild>
                            <Link to="/register" onClick={closeMobile}>Register</Link>
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t pt-3">
                      <span className="px-3 text-sm">Theme</span>{themeButton}
                    </div>
                    {isMobileOpen && (
                      <div className="relative mt-2 flex items-center justify-between" onClick={e => e.stopPropagation()}>
                        <span className="px-3 text-sm">Notifications</span>
                        <NotificationBell getToken={() => token} open={isNotifOpen}
                          onToggle={() => setIsNotifOpen(o => !o)} onClose={() => setIsNotifOpen(false)} />
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
