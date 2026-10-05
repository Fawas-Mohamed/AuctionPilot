import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="p-6 text-muted-foreground">Loading account...</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!user.roles?.includes("Admin")) return <p className="p-6 text-muted-foreground">Administrator access is required.</p>;
  return <>{children}</>;
}
