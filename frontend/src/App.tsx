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
            <main className="flex-1"><Outlet /></main>
            <Footer />
        </div>
    );
};
export default App;
