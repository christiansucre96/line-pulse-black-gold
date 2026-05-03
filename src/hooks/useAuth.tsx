// src/hooks/useAuth.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface Profile {
  id: string;
  email: string;
  display_name: string;
  is_admin?: boolean;
  role?: string;
  subscription_tier?: string;
  subscription_start?: string;
  subscription_end?: string;
  is_active?: boolean;
  is_free_trial?: boolean;
  trial_reason?: string;
  trial_granted_by?: string;
  revenue_generated?: number;
}

interface AuthContextType {
  user: (User & { profile?: Profile }) | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<(User & { profile?: Profile }) | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        setUser(null);
        setProfile(null);
        setSession(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();

      const mergedUser = { ...authUser, profile: profileData };
      setUser(mergedUser);
      setProfile(profileData);

      // ✅ Fast admin check (user_metadata first, fallback to profile)
      let adminFlag = false;
      if (authUser.user_metadata?.is_admin === true) {
        adminFlag = true;
      } else if (profileData?.is_admin === true || profileData?.role === "admin") {
        adminFlag = true;
      }
      setIsAdmin(adminFlag);

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
    } catch (err) {
      console.error("Auth load error:", err);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      loadUser();
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    setIsAdmin(false);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
