import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { startHub, stopHub } from "@/lib/signalr";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
const App: React.FC = () => {
    const { user, loading } = useAuth();
    useEffect(() => {
        if (loading) return;
        if (user) void startHub().catch(() => {});
        else void stopHub();
    }, [user?.id, loading]);
    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <div className="border-b border-border bg-muted/30 px-4 py-2 text-center text-sm text-muted-foreground" role="note">
                Portfolio demo · Synthetic auctions · No payments, shipping or settlement. First load may take about a minute.
            </div>
            <main className="flex-1"><Outlet /></main>
            <Footer />
        </div>
    );
};
export default App;
