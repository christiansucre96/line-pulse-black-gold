import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Scanner from "./pages/Scanner.tsx";
import ParlayBuilder from "./pages/ParlayBuilder.tsx";
import Leaderboard from "./pages/Leaderboard.tsx";
import Roster from "./pages/Roster.tsx";
import Injuries from "./pages/Injuries.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/scanner" element={<Scanner />} />
          <Route path="/parlay" element={<ParlayBuilder />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/roster" element={<Roster />} />
          <Route path="/injuries" element={<Injuries />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
