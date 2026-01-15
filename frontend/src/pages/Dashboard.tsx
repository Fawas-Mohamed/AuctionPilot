import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api"; // your axios wrapper
import { HubConnectionBuilder, HubConnection, LogLevel } from "@microsoft/signalr";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import { toast } from "sonner";
import {
  Gavel,
  Award,
  DollarSign,
  Heart,
  Clock,
  Settings,
  Edit2,
  Shield,
  Users as UsersIcon,
  FileText as AuctionIcon,
  List as ListIcon,
  Eye as DetailsIcon,
} from "lucide-react";

/**
 * Admin Dashboard (merged)
 * - Header (profile + actions) from user's Dashboard component
 * - Core admin logic, SignalR handlers and charts from working AdminDashboard
 * - Adds: PieChart (auction status breakdown) and LineChart (sales trend)
 */

type Auction = {
  id: number;
  title: string;
  currentPrice: number;
  startPrice: number;
  startTime?: string;
  endTime?: string;
  status?: string | number;
  bidCount?: number;
  categoryId?: number | null;
  category?: { id?: number; name?: string } | null;
  createdAt?: string;
};

type WatchlistItem = { id: number; auctionId: number; userId: string };
type DailySales = { date: string; sales: number };

const PIE_COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7f7f"];

export default function AdminDashboard() {
  // --- profile/header state ---
  const [user, setUser] = useState<any>({
    id: undefined,
    name: "Loading…",
    email: "",
    memberSince: "",
    avatar: "",
    bidderNumber: "",
  });

  const userRef = useRef(user);
  userRef.current = user;

  // --- admin metrics/state ---
  const [watchlistCount, setWatchlistCount] = useState<number>(0);
  const [totalBids, setTotalBids] = useState<number>(0);
  const [totalSpend, setTotalSpend] = useState<number>(0);
  const [activeAuctions, setActiveAuctions] = useState<number>(0);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [salesDaily, setSalesDaily] = useState<DailySales[]>([]);
  const [hubError, setHubError] = useState<string | null>(null);
  const hubRef = useRef<HubConnection | null>(null);
  // misc header/debug
  const [lastWatchEvent, setLastWatchEvent] = useState<string | null>(null);
  const formatPrice = (p?: number) =>
  typeof p === "number" ? new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" }).format(p) : "—";
  const navigateTo = (path: string) => { window.location.href = path; };

  // ------------------ load profile ------------------
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const profileRes = await api.get("/account/profile").catch(() => ({ data: null }));
        if (!mounted) return;
        if (profileRes?.data) setUser(prev => ({ ...prev, ...profileRes.data }));
      } catch (e) {
        console.error("Profile load error", e);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  // ------------------ admin data initial fetch ------------------
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const auctionsRes = await api.get<Auction[]>("/admin/auctions");
        const rawAucs = auctionsRes?.data ?? [];

        let watchlistRes;
        try { watchlistRes = await api.get<WatchlistItem[]>("/watchlist"); } catch { watchlistRes = { data: [] } as any; }

        let salesRes;
        try { salesRes = await api.get<{ todaySales: number; monthSales: number; lostAuctions: number; daily: DailySales[] }>("/admin/reports/sales"); } catch { salesRes = null; }

        if (!mounted) return;

        setAuctions(rawAucs);
        setWatchlistCount((watchlistRes?.data?.length) ?? 0);
        recomputeMetrics(rawAucs, salesRes?.data?.daily ?? []);
      } catch (err: any) {
        console.error("Dashboard load failed:", err);
        toast.error("Failed to load dashboard data (see console).");
      }
    };
    void load();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // helper to compute metrics
  const recomputeMetrics = (aucs: Auction[], sales?: DailySales[]) => {
    setActiveAuctions(aucs.filter(a => {
      try {
        if (!a.startTime || !a.endTime) return a.status !== "Closed" && a.status !== 3;
        const now = Date.now();
        const s = new Date(a.startTime).getTime();
        const e = new Date(a.endTime).getTime();
        return now >= s && now <= e;
      } catch {
        return a.status !== "Closed" && a.status !== 3;
      }
    }).length);

    setTotalBids(aucs.reduce((s, a) => s + (a.bidCount ?? 0), 0));

    const spend = aucs.reduce((s, a) => {
      const closed = (a as any).status === "Closed" || (a as any).status === 3 || (a as any).isClosed;
      return s + (closed ? Number(a.currentPrice ?? 0) : 0);
    }, 0);
    setTotalSpend(spend);

    if (!sales || sales.length === 0) {
      const bucket: Record<string, number> = {};
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        bucket[key] = 0;
      }
      aucs.forEach(a => {
        const closed = (a as any).status === "Closed" || (a as any).status === 3 || (a as any).isClosed;
        if (!closed) return;
        const t = a.endTime ?? a.createdAt ?? a.startTime;
        if (!t) return;
        const key = new Date(t).toISOString().slice(0, 10);
        if (bucket[key] !== undefined) bucket[key] += Number(a.currentPrice ?? 0);
      });
      setSalesDaily(Object.keys(bucket).map(k => ({ date: k, sales: Math.round(bucket[k]) })));
    } else {
      setSalesDaily(sales);
    }
  };

  // ------------------ SignalR setup ------------------
  useEffect(() => {
    const startSignalR = async () => {
      try {
        const base = (import.meta.env.VITE_API_URL ?? "https://localhost:62628").replace(/\/$/, "");
        const hubUrl = (import.meta.env.VITE_SIGNALR_URL ?? `${base}/hubs/auction`);
        const conn = new HubConnectionBuilder()
          .withUrl(hubUrl, { accessTokenFactory: () => localStorage.getItem("token") ?? "" })
          .withAutomaticReconnect()
          .configureLogging(LogLevel.Information)
          .build();

        hubRef.current = conn;

        conn.on("AuctionCreated", (payload: any) => {
          const newA = payload && payload.id ? payload as Auction : null;
          if (newA) {
            setAuctions(prev => {
              const next = [newA, ...prev];
              recomputeMetrics(next, salesDaily);
              return next;
            });
          } else {
            void api.get("/admin/auctions").then(r => { setAuctions(r.data); recomputeMetrics(r.data, salesDaily); }).catch(()=>{});
          }
        });

        conn.on("AuctionUpdated", (payload: any) => {
          const id = payload?.id ?? payload?.auctionId;
          if (!id) return;
          setAuctions(prev => {
            const next = prev.map(a => String(a.id) === String(id) ? ({ ...a, ...payload }) : a);
            recomputeMetrics(next, salesDaily);
            return next;
          });
        });

        conn.on("BidPlaced", (payload: any) => {
          try {
            let auctionId: number | null = null;
            let newPrice: number | undefined = undefined;
            let newBidCount: number | undefined = undefined;

            if (Array.isArray(payload)) {
              [auctionId, newPrice, newBidCount] = payload;
            } else if (payload && (payload.AuctionId || payload.auctionId || payload.id)) {
              auctionId = payload.AuctionId ?? payload.auctionId ?? payload.id;
              newPrice = payload.CurrentPrice ?? payload.currentPrice ?? payload.amount;
              newBidCount = payload.BidCount ?? payload.bidCount;
            }

            if (!auctionId) return;

            setAuctions(prev => {
              const next = prev.map(a => a.id === auctionId ? { ...a, currentPrice: newPrice ?? a.currentPrice, bidCount: newBidCount ?? a.bidCount } : a);
              recomputeMetrics(next, salesDaily);
              return next;
            });
          } catch (e) { console.error(e); }
        });

        conn.on("AuctionClosed", (payload: any) => {
          const id = payload?.auctionId ?? payload?.AuctionId ?? payload?.Auction?.id;
          if (!id) return;
          setAuctions(prev => {
            const next = prev.map(a => a.id === id ? ({ ...a, status: "Closed", currentPrice: payload?.finalPrice ?? a.currentPrice }) : a);
            recomputeMetrics(next, salesDaily);
            return next;
          });
        });

        conn.on("WatchlistChanged", (auctionId: number, added: boolean) => {
          void api.get("/watchlist").then(r => setWatchlistCount((r.data?.length) ?? 0)).catch(() => {});
          // small debug message
          setLastWatchEvent(`WatchlistChanged: ${auctionId} ${added ? 'added' : 'removed'}`);
        });

        conn.onreconnecting(err => {
          console.warn("SignalR reconnecting", err);
          setHubError("Realtime reconnecting...");
        });

        conn.onclose(err => {
          console.warn("SignalR closed", err);
          setHubError("Realtime connection closed");
        });

        await conn.start();
        setHubError(null);
        console.log("SignalR connected to hub:", conn.connectionId);

        // join user-specific group if possible
        const myId = userRef.current?.id ?? localStorage.getItem("userId");
        if (myId) {
          try { await conn.invoke("AddToGroup", `user-${myId}`); } catch (e) { /* non-fatal */ }
        }
      } catch (err) {
        console.warn("SignalR start failed", err);
        setHubError("Realtime updates disabled (connection failed)");
      }
    };

    void startSignalR();
    return () => {
      if (hubRef.current) { hubRef.current.stop().catch(() => {}); hubRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const PIE_COLORS = [
    "#2563eb", // Active - blue
    "#16a34a", // Closed - green
    "#e7a83aff", // Upcoming - amber
    "#ef4444", // Other - red
  ];

  // chart data
  const dailyChartData = useMemo(() => {
    if (!salesDaily || salesDaily.length === 0) {
      const now = new Date();
      const arr: DailySales[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i).toISOString().slice(0, 10);
        arr.push({ date: d, sales: 0 });
      }
      return arr;
    }
    return salesDaily;
  }, [salesDaily]);
  



  // PIE: auction status breakdown (Active / Closed / Upcoming / Other)
  const pieData = useMemo(() => {
    const counts: Record<string, number> = { Active: 0, Closed: 0, Upcoming: 0, Other: 0 };
    const now = Date.now();
    auctions.forEach(a => {
      try {
        const s = a.startTime ? new Date(a.startTime).getTime() : undefined;
        const e = a.endTime ? new Date(a.endTime).getTime() : undefined;
        if (e && e < now) counts.Closed++;
        else if (s && s > now) counts.Upcoming++;
        else if ((s && e && s <= now && e >= now) || (!s && !e && a.status !== "Closed")) counts.Active++;
        else counts.Other++;
      } catch {
        counts.Other++;
      }
    });
    return Object.keys(counts).map((k, i) => ({ name: k, value: counts[k] }));
  }, [auctions]);

  // LINE: use dailyChartData (sales) — show sales trend line

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* ---------- Header (from user Dashboard) ---------- */}
        <div className="bg-gradient-to-r from-auction-navy to-auction-navy-light rounded-lg p-8 text-white mb-8">
          <div className="flex items-center space-x-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user.avatar || undefined} />
              <AvatarFallback className="bg-auction-gold text-auction-navy text-2xl font-bold">
                {user.name ? user.name.split(" ").map((n: string) => n[0]).join("") : "U"}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{user.name}</h1>
              <p className="text-gray-200 mb-2">{user.email}</p>
              <div className="flex items-center space-x-4 text-sm">
                <span>Admin</span>
                <span>Member since {user.memberSince || "—"}</span>
              </div>
            </div>

            {/* quick action buttons (kept only in header) */}
            <div className="flex items-center space-x-2">
              <Button size="sm" variant="ghost" onClick={() => navigateTo("/usermanage")}>
                <UsersIcon className="h-4 w-4 mr-2" /> User Manage
              </Button>
              <Button size="sm" variant="ghost" onClick={() => navigateTo("/auctionmanage")}>
                <AuctionIcon className="h-4 w-4 mr-2" /> Auction Manage
              </Button>
              <Button size="sm" variant="ghost" onClick={() => navigateTo("/my-auctions")}>
                <ListIcon className="h-4 w-4 mr-2" /> My Auctions
              </Button>
              <Button size="sm" variant="ghost" onClick={() => navigateTo("/auctions")}>
                <DetailsIcon className="h-4 w-4 mr-2" /> Auction Details
              </Button>
              <Button variant="outline" className="bg-white/10 border-white text-white hover:bg-white hover:text-auction-navy" onClick={() => navigateTo("/profile")}>
                <Settings className="h-4 w-4 mr-2" /> Account Settings
              </Button>
            </div>
          </div>
        </div>

        {hubError && (
          <div className="mb-4 rounded-md bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-yellow-600" />
              <div className="text-sm text-yellow-700">{hubError}</div>
            </div>
          </div>
        )}

        {/* debug / last event */}
        <div className="flex items-center justify-end gap-2 mb-4">
          <Button size="sm" variant="ghost" onClick={async () => { const r = await api.get('/account/watchlist'); /* won't fail UI */ }}>
            Refresh Watchlist
          </Button>
          <div className="text-sm text-muted-foreground">Last watch event:</div>
          <div className="text-sm font-mono text-auction-navy">{lastWatchEvent ? lastWatchEvent.slice(0, 80) : "—"}</div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <Card><CardContent><div className="text-sm">Watchlist</div><div className="text-2xl font-bold">{watchlistCount}</div></CardContent></Card>
          <Card><CardContent><div className="text-sm">Total Bids</div><div className="text-2xl font-bold">{totalBids}</div></CardContent></Card>
          <Card><CardContent><div className="text-sm">Total Spend</div><div className="text-2xl font-bold">{formatPrice(totalSpend)}</div></CardContent></Card>
          <Card><CardContent><div className="text-sm">Active Auctions</div><div className="text-2xl font-bold">{activeAuctions}</div></CardContent></Card>
        </div>

        {/* Sales Overview (Bar) */}
        <Card className="mb-6">
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Sales Overview (last 7 days)</h2>
                <div className="text-sm text-muted-foreground">Live updates via SignalR</div>
              </div>
              <div className="space-x-2">
                <Button size="sm" onClick={() => { void api.get("/admin/reports/sales").then(r => { setSalesDaily(r.data.daily ?? []); toast.success("Reports refreshed"); }).catch(()=> toast.error("Failed to refresh reports")); }}>
                  Refresh Reports
                </Button>
                <Button size="sm" variant="outline" onClick={() => { void api.get("/admin/auctions").then(r => { setAuctions(r.data); recomputeMetrics(r.data); toast.success("Auctions refreshed"); }).catch(()=> toast.error("Failed to refresh auctions")); }}>
                  Refresh Auctions
                </Button>
              </div>
            </div>

            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyChartData}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#eb25e1ff" stopOpacity={0.9}/>
                        <stop offset="95%" stopColor="#050609ff" stopOpacity={0.5}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="sales" fill="url(#barGradient)" />
                  </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* PIE CHART: Auction status breakdown */}
        <Card className="mb-6">
          <CardContent>
            <h2 className="text-lg font-semibold mb-3">Auction Status Breakdown</h2>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={40} label>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* LINE CHART: Sales trend */}
        <Card className="mb-6">
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Sales Trend (last 7 days)</h2>
                <div className="text-sm text-muted-foreground">Sales by day — live-updated</div>
              </div>
            </div>

            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="sales" stroke="#8884d8" activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
