// src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import App from "./App";

// Pages (ensure these files exist under src/pages)
import Index from "@/pages/Index";
import Browse from "@/pages/Browse";
import AuctionDetails from "@/pages/AuctionDetails";
import CreateAuction from "@/pages/CreateAuction";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Categories from "@/pages/Categories";
import HowItWorks from "@/pages/HowItWorks";
import HelpCenter from "@/pages/HelpCenter";
import UserProfile from "@/pages/UserProfile";
import MyBids from "@/pages/MyBids";
import Watchlist from "@/pages/Watchlist";
import AboutUs from "@/pages/AboutUs";
import Contact from "@/pages/Contact";
import MyAuctions from "@/pages/MyAuctions";
import LiveAuction from "@/pages/LiveAuction";
import AuctionCalendar from "@/pages/AuctionCalendar";
import PastAuctions from "@/pages/PastAuctions";
import NotFound from "@/pages/NotFound";
import Notifications from "@/pages/NotificationsPage";
import "./index.css";
import AuctionsPage from "./pages/AuctionsPage";
import CreateConsignment from "./pages/CreateConsignment";
import AdminAuctions from "./pages/Admin/AdminAuctions";
import PaymentSuccess from "./pages/PaymentSuccess";

import AdminReports from "./pages/Admin/AdminReports";
import AdminUsers from "./pages/Admin/AdminUsers";
import CategoryPage from "./pages/CategoryPage";
import AuctionResultPage from "./pages/AuctionResultPage";
import Auctions from "./pages/Auctions";
import AuctionsList from "./pages/AuctionsList";
import CreateAuctionButton from "./components/CreateAuctionButton";


const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            {/* App is a layout (Header/Footer) and uses <Outlet /> */}
            <Routes>
              <Route path="/" element={<App />}>
                <Route index element={<Index />} />
                <Route path="/auction-result/:orderId" element={<AuctionResultPage />} />
                <Route path="/auctions" element={<Browse />} />
                <Route path="auctions/create" element={<CreateAuction />} />
                <Route path="auctions/:id" element={<AuctionDetails />} />
                <Route path="categories/:category" element={<CategoryPage />} />
                <Route path="categery" element={<Categories />} />
                <Route path="how-it-works" element={<HowItWorks />} />
                <Route path="/payment-success" element={<PaymentSuccess />} />
                <Route path="help" element={<HelpCenter />} />
                <Route path="login" element={<Login />} />
                <Route path="register" element={<Register />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="profile" element={<UserProfile />} />
                <Route path="my-bids" element={<MyBids />} />
                <Route path="watchlist" element={<Watchlist />} />
                <Route path="about" element={<AboutUs />} />
                <Route path="contact" element={<Contact />} />
                <Route path="my-auctions" element={<MyAuctions />} />
                <Route path="my" element={<Notifications />} />
                <Route path="live" element={<LiveAuction />} />
                <Route path="calendar" element={<AuctionCalendar />} />
                <Route path="past-auctions" element={<PastAuctions />} />
                <Route path="hii" element={<AuctionsPage />} />
                <Route path="hello" element={<CreateConsignment />} />
                <Route path="watchlist" element={<Watchlist />} />
                <Route path="auctionmanage" element={<AdminAuctions />} />
                 <Route path="/admin"element={<AdminReports/>}/>
                <Route path="usermanage"element={<AdminUsers/>}/>
                <Route path="/tt" element={<AuctionsList/>}/>
                <Route path="/tq" element={<CreateAuctionButton/>}/>
                
               
              
                
                {/* catch-all */}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
