// components/AdminRoute.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "src/contexts/AuthContext.tsx"; // custom auth hook

export default function AdminRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (!user.roles?.includes("Admin")) return <Navigate to="/" replace />;

  return children;
}
