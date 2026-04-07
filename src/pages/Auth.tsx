import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";

// Lazy load all pages
const Index = lazy(() => import("./pages/Index"));
const Scanner = lazy(() => import("./pages/Scanner"));
const ParlayBuilder = lazy(() => import("./pages/ParlayBuilder"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Roster = lazy(() => import("./pages/Roster"));
const Injuries = lazy(() => import("./pages/Injuries"));
const TopPicks = lazy(() => import("./pages/TopPicks"));
// const Auth = lazy(() => import("./pages/Auth"));   // Temporarily removed
const Profile = lazy(() => import("./pages/Profile"));
const Admin = lazy(() => import("./pages/Admin"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => {
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
            <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
              <Routes>
                <Route path="/" element={<Index />} />
                {/* <Route path="/auth" element={<Auth />} />  Temporarily disabled */}
                <Route path="/reset-password" element={<ResetPassword />} />

                <Route path="/scanner" element={<Scanner />} />
                <Route path="/parlay" element={<ParlayBuilder />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/roster" element={<Roster />} />
                <Route path="/injuries" element={<Injuries />} />
                <Route path="/top-picks" element={<TopPicks />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/admin" element={<Admin />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
