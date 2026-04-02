import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";

import Index from "./pages/Index.tsx";
import Scanner from "./pages/Scanner.tsx";
import ParlayBuilder from "./pages/ParlayBuilder.tsx";
import Leaderboard from "./pages/Leaderboard.tsx";
import Roster from "./pages/Roster.tsx";
import Injuries from "./pages/Injuries.tsx";
import Auth from "./pages/Auth.tsx";
import Profile from "./pages/Profile.tsx";
import Admin from "./pages/Admin.tsx";
import ResetPassword from "./pages/ResetPassword.tsx"; // ✅ ADD THIS
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* PUBLIC */}
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} /> {/* ✅ ADD */}

            {/* PROTECTED (handled inside pages) */}
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
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
