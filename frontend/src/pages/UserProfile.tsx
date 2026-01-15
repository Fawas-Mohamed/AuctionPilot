// src/pages/UserProfile.tsx
import React, { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Mail, Phone, MapPin, Calendar, Shield, Settings, Edit2, User } from "lucide-react";
import api from "@/lib/api";
import { HubConnectionBuilder, HubConnection, LogLevel } from "@microsoft/signalr";

/**
 * Robust UserProfile:
 * - attempts multiple API paths for profile & stats (so it works regardless of backend route names)
 * - displays debug info when calls fail (403/404 etc.)
 * - SignalR connection uses VITE_SIGNALR_URL, then VITE_API_URL-derived hub, then window.location origin
 */

const FALLBACK_PROFILE_ENDPOINTS = [
  "/account/profile",
  "/profile",
  "/users/me",
  "/api/account/profile",
  "/api/profile",
  "/api/users/me"
];

const FALLBACK_STATS_ENDPOINTS = [
  "/account/stats",
  "/profile/stats",
  "/api/account/stats",
  "/api/profile/stats",
  "/api/stats"
];

const tryEndPoints = async (paths: string[]) => {
  for (const p of paths) {
    try {
      const res = await api.get(p);
      if (res?.status === 200 && res.data != null) {
        return { ok: true, path: p, data: res.data };
      }
    } catch (err: any) {
      // swallow; we'll collect error info
    }
  }
  return { ok: false };
};

const UserProfile: React.FC = () => {
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [profile, setProfile] = useState<any>({
    id: null,
    name: "",
    email: "",
    phone: "",
    location: "",
    bio: "",
    memberSince: "",
    verification: "",
    avatar: "",
    avatarUrl:""
  });
  const [stats, setStats] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [debug, setDebug] = useState<string[]>([]);
  const hubRef = useRef<HubConnection | null>(null);
  const mountedRef = useRef(true);

  const apiBase = (import.meta.env.VITE_API_URL ?? "https://localhost:62628").replace(/\/$/, "");
  const signalRUrl = import.meta.env.VITE_SIGNALR_URL ?? `${apiBase.replace(/\/api$|\/$/, "")}/hubs/auction`;

  // helper: safe image normalization
  const normalizeImage = (avatarUrl: string | null | undefined) => {
    if (!avatarUrl) return null;
    if (avatarUrl.startsWith("http")) return avatarUrl;
    return `https://localhost:62628${avatarUrl}`;
  };


  const uploadAvatar = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  try {
    await api.post("/account/avatar", formData, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    });
     const res = await api.get("/account/profile", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    });
    setProfile(res.data); 

    alert("Avatar updated successfully");
  } catch (err) {
    console.error(err);
    alert("Upload failed");
  }
};


  useEffect(() => {
    mountedRef.current = true;
    const loadAll = async () => {
      setLoading(true);
      setDebug([]);

      // Try several endpoints for profile
      const profileTry = await tryEndPoints(FALLBACK_PROFILE_ENDPOINTS);
      if (profileTry.ok) {
        setProfile((prev) => ({ ...prev, ...profileTry.data }));
        setDebug((d) => [...d, `profile loaded from ${profileTry.path}`]);
      } else {
        setDebug((d) => [...d, `profile: no known endpoint returned data (tried ${FALLBACK_PROFILE_ENDPOINTS.join(", ")})`]);
      }

      // Try several endpoints for stats
      const statsTry = await tryEndPoints(FALLBACK_STATS_ENDPOINTS);
      if (statsTry.ok) {
        // If the server returns an object, attempt to map to expected array
        const sdata = Array.isArray(statsTry.data)
          ? statsTry.data
          : mapStatsObjectToArray(statsTry.data);
        setStats(sdata);
        setDebug((d) => [...d, `stats loaded from ${statsTry.path}`]);
      } else {
        setStats([
          
        ]);
        setDebug((d) => [...d, `stats: no known endpoint returned data (tried ${FALLBACK_STATS_ENDPOINTS.join(", ")})`]);
      }
      setLoading(false);
    };
    void loadAll();

    // SignalR setup with robust fallback URL
    const token = localStorage.getItem("token") ?? "";
    const envSignalR = import.meta.env.VITE_SIGNALR_URL;
    const apiUrl = import.meta.env.VITE_API_URL;
    const fallbackHub = apiUrl
      ? `${apiUrl.replace(/\/api\/?$/, "").replace(/\/$/, "")}/hubs/auction`
      : `${window.location.origin}/hubs/auction`;
    const hubUrl = envSignalR ?? fallbackHub;

    setDebug((d) => [...d, `SignalR trying: ${hubUrl}`]);

    const conn = new HubConnectionBuilder()
      .withUrl(hubUrl, { accessTokenFactory: () => token })
      .configureLogging(LogLevel.Warning)
      .withAutomaticReconnect()
      .build();
    hubRef.current = conn;

    // Helper to refresh stats by trying fallback endpoints (used by handlers)
    const refreshStats = async (reason?: string) => {
      if (!mountedRef.current) return;
      try {
        const r = await tryEndPoints(FALLBACK_STATS_ENDPOINTS);
        if (r.ok) {
          const sdata = Array.isArray(r.data) ? r.data : mapStatsObjectToArray(r.data);
          setStats(sdata);
          setDebug((d) => [...d, `stats refreshed${reason ? ` (${reason})` : ""} from ${r.path}`]);
          return;
        }
      } catch (e: any) {
        // swallow
      }
      // fallback: if endpoint not found, try to adjust local state heuristically
      setDebug((d) => [...d, `stats refresh attempted but no endpoint found${reason ? ` (${reason})` : ""}`]);
    };

    // Map server object -> stats array (best-effort)
    function mapStatsObjectToArray(obj: any) {
      if (!obj) return [];
      // common fields: auctionsWon, totalSpent, itemsWatched, activeBids
      return [
        { label: "Auctions Won", value: obj.auctionsWon ?? obj.auctions_won ?? obj.wonCount ?? obj.wins ?? "0" },
        { label: "Total Spent", value: typeof obj.totalSpent !== "undefined" ? formatCurrency(obj.totalSpent) : obj.total_spent ?? "$0" },
        { label: "Items Watched", value: obj.itemsWatched ?? obj.items_watched ?? obj.watchlistCount ?? obj.watched ?? "0" },
        { label: "Active Bids", value: obj.activeBids ?? obj.active_bids ?? obj.activeBidCount ?? obj.bids ?? "0" }
      ];
    }

    function formatCurrency(val: any) {
      if (val == null) return "$0";
      if (typeof val === "number") return new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" }).format(val);
      return String(val);
    }

    // Attach handlers BEFORE start to avoid missed events
    const bidPlacedHandler = (_payload: any) => {
      // simply refresh stats from server if possible
      void refreshStats("BidPlaced");
    };

    const auctionClosedHandler = (_payload: any) => {
      void refreshStats("AuctionClosed");
    };

    const notificationHandler = (_payload: any) => {
      void refreshStats("NotificationCreated");
    };

    const profileUpdatedHandler = (payload: any) => {
      if (!payload) return;
      // merge in if it matches current user id or payload contains no user id (server assumption)
      if (!payload.userId || String(payload.userId) === String(profile.id)) {
        setProfile((prev: any) => ({ ...prev, ...payload }));
        setDebug((dd) => [...dd, "ProfileUpdated event merged"]);
      }
    };

    // register handlers
    conn.on("BidPlaced", bidPlacedHandler);
    conn.on("AuctionClosed", auctionClosedHandler);
    conn.on("NotificationCreated", notificationHandler);
    conn.on("ProfileUpdated", profileUpdatedHandler);

    // Start
    conn.start()
      .then(() => {
        setDebug((d) => [...d, "SignalR connected"]);
        // Optionally join the user's group if your server supports it
        try {
          const userId = profile?.id;
          if (userId) {
            conn.invoke("JoinUserGroup", `user-${userId}`).catch(() => {});
          }
        } catch {
          // ignore
        }
      })
      .catch((err) => {
        console.warn("SignalR connection failed:", err);
        setDebug((d) => [...d, `SignalR failed during start: ${err?.message ?? String(err)}`]);
      });

    // cleanup
    return () => {
      mountedRef.current = false;
      if (hubRef.current) {
        try {
          hubRef.current.off("BidPlaced", bidPlacedHandler);
          hubRef.current.off("AuctionClosed", auctionClosedHandler);
          hubRef.current.off("NotificationCreated", notificationHandler);
          hubRef.current.off("ProfileUpdated", profileUpdatedHandler);
          hubRef.current.stop().catch(() => {});
        } catch {
          // swallow
        }
        hubRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  const toggleEdit = () => setIsEditing((v) => !v);
  const saveProfile = async () => {
    setSaving(true);
    try {
      // find an endpoint to PUT profile to
      const possibleSavePaths = ["/account/profile", "/profile", "/api/account/profile", "/api/profile", "/users/me"];
      let saved = false;
      for (const p of possibleSavePaths) {
        try {
          await api.put(p, {
            name: profile.name,
            phoneNumber: profile.phone,
            location: profile.location,
            bio: profile.bio
          });
          setDebug((d) => [...d, `Saved profile via ${p}`]);
          saved = true;
          break;
        } catch (e) {
          // try next
        }
      }
      if (!saved) {
        alert("Save failed: server update endpoint not found. Check backend routes.");
      } else {
        setIsEditing(false);
      }
    } catch (e) {
      console.error("saveProfile failed", e);
      alert("Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <Card className="auction-shadow-elegant">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                <div className="relative">
                  <Avatar className="w-24 h-24">
  <AvatarImage src={normalizeImage(profile.avatarUrl)} />
  <AvatarFallback className="text-2xl font-bold">
    {profile.name?.[0]?.toUpperCase() ?? "U"}
  </AvatarFallback>
</Avatar>

             <Button
  size="icon"
  variant="premium"
  className="absolute -bottom-2 -right-2 w-8 h-8 p-1 rounded-full hover:scale-110 transition-transform"
  onClick={() => fileInputRef.current?.click()}
>
  <Camera className="w-4 h-4 text-white" />
</Button>




<input
  type="file"
  accept="image/*"
  ref={fileInputRef}
  hidden
  onChange={(e) => {
    if (e.target.files?.[0]) {
      uploadAvatar(e.target.files[0]);
    }
  }}
/>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h1 className="text-3xl font-bold text-auction-navy">{profile.name || "User"}</h1>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">Member since {profile.memberSince || "—"}</Badge>
                      </div>
                    </div>
                    <div>
                      <Button onClick={toggleEdit} variant={isEditing ? "outline" : "premium"} className="flex items-center gap-2">
                        <Edit2 className="w-4 h-4" />
                        {isEditing ? "Cancel" : "Edit Profile"}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {stats.map((s, idx) => (
                      <div key={idx} className="text-center p-4 rounded-lg bg-muted/30">
                        <div className="text-2xl font-bold text-auction-premium">{s.value}</div>
                        <div className="text-sm text-muted-foreground">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="auction-shadow-elegant">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-auction-navy"><Settings className="w-5 h-5" /> Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" value={profile.name ?? ""} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={profile.email ?? ""} readOnly />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="location">Location</Label>
                      <Input id="location" value={profile.location ?? ""} onChange={(e) => setProfile({ ...profile, location: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea id="bio" value={profile.bio ?? ""} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} rows={4} />
                    </div>

                    <Button variant="premium" className="w-full" onClick={saveProfile} disabled={saving}>
                      {saving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3"><User className="w-5 h-5 text-auction-premium" /> <span>{profile.name}</span></div>
                    <div className="flex items-center gap-3"><Mail className="w-5 h-5 text-auction-premium" /> <span>{profile.email}</span></div>
                    <div className="flex items-center gap-3"><Phone className="w-5 h-5 text-auction-premium" /> <span>{profile.phone}</span></div>
                    <div className="flex items-center gap-3"><MapPin className="w-5 h-5 text-auction-premium" /> <span>{profile.location}</span></div>
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-auction-premium mt-1" />
                      <div>
                        <div className="font-medium">Member Since</div>
                        <div className="text-muted-foreground">{profile.memberSince}</div>
                      </div>
                    </div>
                    <div className="pt-4 border-t">
                      <h4 className="font-medium mb-2">About</h4>
                      <p className="text-muted-foreground">{profile.bio}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="auction-shadow-elegant">
              <CardHeader>
                <CardTitle className="text-auction-navy">Account Security</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800">
                    <Shield className="w-5 h-5" />
                    <span className="font-medium">Account Verified</span>
                  </div>
                  <p className="text-sm text-green-600 mt-1">Your identity has been verified and your account is secure.</p>
                </div>

                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-start">Change Password</Button>
                  <Button variant="outline" className="w-full justify-start">Two-Factor Authentication</Button>
                  <Button variant="outline" className="w-full justify-start">Privacy Settings</Button>
                  <Button variant="outline" className="w-full justify-start">Download Data</Button>
                </div>

                <div className="pt-4 border-t">
                  <Button variant="destructive" className="w-full">Delete Account</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* debug log (optional) */}
          {/*<div className="text-sm text-muted-foreground">
            <strong>Debug:</strong>
            <ul className="list-disc pl-6">
              {debug.slice(-8).map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </div>*/}
        </div>
      </main>
    </div>
  );
};

export default UserProfile;
