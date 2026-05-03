// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster } from "sonner";
import { useAuth } from "@/hooks/useAuth";

// Layouts & Wrappers
import AppLayout from "@/components/AppLayout";
import AdminRoute from "@/components/AdminRoute";

// ✅ Your Pages
import Auth from "@/pages/Auth";
import Scanner from "@/pages/Scanner";
import Admin from "@/pages/Admin";
import DataStudio from "@/pages/DataStudio";

// ✅ Lazy‑loaded Horse Racing page
const HorseRacing = lazy(() => import("@/pages/HorseRacing"));

// ── Loading Spinner ────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060a0f]">
      <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ── Public Route: Redirects authenticated users to /scanner ─
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/scanner" replace />;
  return <>{children}</>;
}

// ── Protected Route: Redirects unauthenticated users to /auth ─
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

// ── App Layout Wrapper ─────────────────────────────────
function AppLayoutWrapper() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

// ── Main App Component ─────────────────────────────────
function AppContent() {
  return (
    <Router>
      <div className="min-h-screen bg-[#060a0f] text-gray-100">
        <Routes>
          {/* 🔓 PUBLIC ROUTE: Login/Signup */}
          <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />

          {/* 🔐 PROTECTED ROUTES: Requires Login */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayoutWrapper />
              </ProtectedRoute>
            }
          >
            {/* Default: go to scanner */}
            <Route index element={<Navigate to="/scanner" replace />} />
            
            {/* Main App Pages */}
            <Route path="scanner" element={<Scanner />} />
            
            {/* 🐎 Horse Racing Page (lazy loaded) */}
            <Route
              path="horse-racing"
              element={
                <Suspense fallback={<LoadingScreen />}>
                  <HorseRacing />
                </Suspense>
              }
            />
            
            {/* Admin-Only Pages */}
            <Route
              path="admin"
              element={
                <AdminRoute>
                  <Admin />
                </AdminRoute>
              }
            />
            
            <Route
              path="studio"
              element={
                <AdminRoute>
                  <DataStudio />
                </AdminRoute>
              }
            />
          </Route>

          {/* Catch-all: unknown URLs go to auth */}
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>

        {/* Global Toast Notifications */}
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
  return <AppContent />;
}
