// src/components/AdminRoute.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface AdminRouteProps {
  children: JSX.Element;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check user_roles table
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) {
        console.error("Admin check error:", error.message);
        navigate("/scanner");
        return;
      }

      const isAdminUser = data?.some((r) => r.role === "admin");

      // Also check profiles table as fallback
      if (!isAdminUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin, role")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.is_admin === true || profile?.role === "admin") {
          setIsAdmin(true);
          setLoading(false);
          return;
        }

        navigate("/scanner");
      } else {
        setIsAdmin(true);
      }

      setLoading(false);
    };

    checkAdmin();
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-white">
        Checking permissions...
      </div>
    );
  }

  return isAdmin ? children : null;
}
