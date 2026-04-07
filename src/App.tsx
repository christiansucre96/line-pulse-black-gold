import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { AuthProvider } from "@/hooks/useAuth";

import { Toaster as Sonner } from "sonner";

// Pages
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Scanner = lazy(() => import("./pages/Scanner"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function App() {
  // Handle password reset redirect
  useEffect(() => {
    const hash = window.location.hash;

    if (hash.includes("access_token") && hash.includes("type=recovery")) {
      window.location.href = "/reset-password" + hash;
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading...</div>}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/scanner" element={<Scanner />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
