// src/App.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster as Sonner } from "sonner";

// ✅ Lazy load all pages for optimal performance
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Scanner = lazy(() => import("./pages/Scanner"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Admin = lazy(() => import("./pages/Admin"));
const Injuries = lazy(() => import("./pages/Injuries"));
const Roster = lazy(() => import("./pages/Roster"));
const ParlayBuilder = lazy(() => import("./pages/ParlayBuilder"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Profile = lazy(() => import("./pages/Profile"));
const TopPicks = lazy(() => import("./pages/TopPicks"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  // Handle password reset redirect from Supabase
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("access_token") && hash.includes("type=recovery")) {
      window.location.href = "/reset-password" + hash;
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Sonner 
        position="top-right"
        richColors
        closeButton
        theme="dark"
      />
      <BrowserRouter>
        <AuthProvider>
          <Suspense 
            fallback={
              <div className="h-screen w-full flex items-center justify-center bg-gray-950">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-400 text-sm">Loading LinePulse...</p>
                </div>
              </div>
            }
          >
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              
              {/* Protected Routes - require auth */}
              <Route path="/scanner" element={<Scanner />} />
              <Route path="/parlay" element={<ParlayBuilder />} />
              <Route path="/injuries" element={<Injuries />} />
              <Route path="/roster" element={<Roster />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/top-picks" element={<TopPicks />} />
              
              {/* Admin Route - requires admin role */}
              <Route path="/admin" element={<Admin />} />
              
              {/* 404 Fallback */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
