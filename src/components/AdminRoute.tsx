import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function AdminRoute({ children }: any) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) return <Navigate to="/login" />;

  if (!user.profile?.is_admin && user.profile?.role !== "admin") {
    return <Navigate to="/scanner" />;
  }

  return children;
}
