import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";

// Pages
import Index from "./pages/Index";
import Scanner from "./pages/Scanner";
import ParlayBuilder from "./pages/ParlayBuilder";
import Leaderboard from "./pages/Leaderboard";
import Roster from "./pages/Roster";
import Injuries from "./pages/Injuries";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  // 🔥 CRITICAL: Handles password reset session from email link
  useEffect(() => {
    const handleAuthRedirect = async () => {
      const hash = window.location.hash;

      if (hash && hash.includes("access_token")) {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Session error:", error.message);
        } else if (data?.session) {
          console.log("✅ Session restored from reset link");
        }
      }
    };

    handleAuthRedirect();
  }, []);

  return (
    <Routes>
      {/* PUBLIC */}
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* MAIN APP */}
      <Route path="/scanner" element={<Scanner />} />
      <Route path="/parlay" element={<ParlayBuilder />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/roster" element={<Roster />} />
      <Route path="/injuries" element={<Injuries />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/admin" element={<Admin />} />

      {/* FALLBACK */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
