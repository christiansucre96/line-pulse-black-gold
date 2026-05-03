// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { AuthProvider } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import AdminRoute from "@/components/AdminRoute";
import Auth from "@/pages/Auth";
import Scanner from "@/pages/Scanner";
import Admin from "@/pages/Admin";

const HorseRacing  = lazy(() => import("@/pages/HorseRacing"));
const Injuries     = lazy(() => import("@/pages/Injuries"));
const Roster       = lazy(() => import("@/pages/Roster"));
const ParlayBuilder= lazy(() => import("@/pages/ParlayBuilder"));
const Leaderboard  = lazy(() => import("@/pages/Leaderboard"));
const Profile      = lazy(() => import("@/pages/Profile"));
const ResetPassword= lazy(() => import("@/pages/ResetPassword"));
const NotFound     = lazy(() => import("@/pages/NotFound"));

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060a0f]">
      <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/scanner" replace />;
  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AppLayoutWrapper() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

function AppContent() {
  return (
    <Router>
      <div className="min-h-screen bg-[#060a0f] text-gray-100">
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {/* Public */}
            <Route path="/auth"           element={<PublicRoute><Auth /></PublicRoute>} />
            <Route path="/login"          element={<Navigate to="/auth" replace />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected */}
            <Route path="/" element={<ProtectedRoute><AppLayoutWrapper /></ProtectedRoute>}>
              <Route index element={<Navigate to="/scanner" replace />} />
              <Route path="scanner"      element={<Scanner />} />
              <Route path="parlay"       element={<ParlayBuilder />} />
              <Route path="leaderboard"  element={<Leaderboard />} />
              <Route path="roster"       element={<Roster />} />
              <Route path="injuries"     element={<Injuries />} />
              <Route path="profile"      element={<Profile />} />
              <Route path="horse-racing" element={<HorseRacing />} />
              <Route path="admin"        element={<AdminRoute><Admin /></AdminRoute>} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/auth" replace />} />
          </Routes>
        </Suspense>

        <Toaster
          position="top-right"
          richColors
          theme="dark"
          toastOptions={{
            style: {
              background: "#0b1120",
              border: "1px solid #1e293b",
              color: "#e2e8f0",
            },
          }}
        />
      </div>
    </Router>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
