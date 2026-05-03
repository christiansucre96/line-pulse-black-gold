// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuth } from "@/hooks/useAuth"; // ✅ Only import the hook

// Layouts & Wrappers
import AppLayout from "@/components/AppLayout";
import AdminRoute from "@/components/AdminRoute";

// Pages
import Auth from "@/pages/Auth";
import Scanner from "@/pages/Scanner";
import Admin from "@/pages/Admin";
import DataStudio from "@/pages/DataStudio";
import NotFound from "@/pages/NotFound";

// ── Protected Route Wrapper (Login Required) ──────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060a0f]">
        <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

// ── Main App Component ──────────────────────────────────────────────────
function AppContent() {
  return (
    <Router>
      {/* ✅ REMOVED: <AuthProvider> wrapper — not needed if useAuth handles it */}
      <div className="min-h-screen bg-[#060a0f] text-gray-100">
        <Routes>
          {/* ── PUBLIC ROUTES ───────────────────────────────────────── */}
          <Route path="/auth" element={<Auth />} />
          
          {/* ── PROTECTED APP ROUTES (AppLayout) ────────────────────── */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            {/* Default redirect to Scanner */}
            <Route index element={<Navigate to="/scanner" replace />} />
            
            {/* Scanner */}
            <Route path="scanner" element={<Scanner />} />
            
            {/* Admin Routes (Wrapped in AdminRoute) */}
            <Route
              path="admin"
              element={
                <AdminRoute>
                  <Admin />
                </AdminRoute>
              }
            />
            
            {/* ✅ Data Studio Route (Admin Only) */}
            <Route
              path="studio"
              element={
                <AdminRoute>
                  <DataStudio />
                </AdminRoute>
              }
            />
          </Route>

          {/* Catch-all 404 */}
          <Route path="*" element={<NotFound />} />
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
      {/* ✅ REMOVED: </AuthProvider> */}
    </Router>
  );
}

export default function App() {
  return <AppContent />;
}
