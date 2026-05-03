// src/components/AdminRoute.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface AdminRouteProps {
  children: React.ReactNode;
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

      try {
        // Check user_roles table first
        const {  roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (roleError) {
          console.error("Admin role check error:", roleError.message);
        }

        const hasAdminRole = roleData?.some((r) => r.role === "admin");

        // Fallback: Check profiles table
        if (!hasAdminRole) {
          const {  profile, error: profileError } = await supabase
            .from("profiles")
            .select("is_admin")
            .eq("id", user.id)
            .maybeSingle();

          if (profileError) {
            console.error("Profile check error:", profileError.message);
          }

          if (profile?.is_admin === true) {
            setIsAdmin(true);
            setLoading(false);
            return;
          }
        } else {
          setIsAdmin(true);
        }

        // If not admin, redirect
        if (!isAdmin) {
          navigate("/scanner");
        }
      } catch (err) {
        console.error("Admin check failed:", err);
        navigate("/scanner");
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [user, navigate, isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060a0f]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Only render children if admin
  return isAdmin ? <>{children}</> : null;
}
