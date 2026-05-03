// src/components/AdminRoute.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface AdminRouteProps {
  children: React.ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { user, isAdmin, loading } = useAuth();

  // Show loading while auth initializes
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060a0f]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // 🔑 CRITICAL: Trust useAuth's isAdmin value
  // The useAuth hook already checks:
  // 1. user.user_metadata.is_admin
  // 2. profiles.is_admin table
  // 3. Your email bypass (christiansucre1@gmail.com)
  const forceAdmin = user.email === 'christiansucre1@gmail.com';
  
  if (!isAdmin && !forceAdmin) {
    return <Navigate to="/scanner" replace />;
  }

  // ✅ Admin confirmed - render the protected page
  return <>{children}</>;
}
