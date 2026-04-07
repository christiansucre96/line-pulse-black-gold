import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useEffect } from "react";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";

import Index from "./pages/Index";
import Scanner from "./pages/Scanner";
import ParlayBuilder from "./pages/ParlayBuilder";
import Leaderboard from "./pages/Leaderboard";
import Roster from "./pages/Roster";
import Injuries from "./pages/Injuries";
import TopPicks from "./pages/TopPicks";  // ✅ ADD THIS IMPORT
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {

  // 🔥 FIX: catch Supabase recovery token
  useEffect(() => {
    const hash = window.location.hash;

    if (hash.includes("access_token") && hash.includes("type=recovery")) {
      window.location.href = "/reset-password" + hash;
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              <Route path="/scanner" element={<Scanner />} />
              <Route path="/parlay" element={<ParlayBuilder />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/roster" element={<Roster />} />
              <Route path="/injuries" element={<Injuries />} />
              <Route path="/top-picks" element={<TopPicks />} />  {/* ✅ ADD THIS ROUTE */}
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<Admin />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
