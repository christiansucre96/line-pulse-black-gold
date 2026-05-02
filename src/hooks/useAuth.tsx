// src/context/AuthContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

// Extend User type to include profile (or use a custom interface)
interface Profile {
  id: string;
  email: string;
  display_name: string;
  is_admin?: boolean;
  role?: string;
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

  // Load user and profile using getUser() + profile fetch
  const loadUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      setUser(null);
      setProfile(null);
      setSession(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    // Fetch profile from the profiles table
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    const mergedUser = { ...authUser, profile: profileData };
    setUser(mergedUser);
    setProfile(profileData);
    setIsAdmin(profileData?.is_admin === true || profileData?.role === "admin");

    // Also get current session
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    setSession(currentSession);

    setLoading(false);
  };

  useEffect(() => {
    loadUser();

    // Listen for auth changes (sign out, token refresh, etc.)
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
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
