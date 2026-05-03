// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuth } from "@/hooks/useAuth";

// Layouts & Wrappers
import AppLayout from "@/components/AppLayout";
import AdminRoute from "@/components/AdminRoute";

// ✅ ONLY import pages that actually exist in your project:
import Scanner from "@/pages/Scanner";
import Admin from "@/pages/Admin";
import DataStudio from "@/pages/DataStudio";
// import Auth from "@/pages/Auth"; // ← Remove if you don't have this file
import NotFound from "@/pages/NotFound";

// ── Protected Route Wrapper ──────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060a0f]">
        <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />; // Redirect to home if not logged in
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
          {/* ── PUBLIC ROUTES ───────────────────────── */}
          {/* If you have a login page, uncomment and adjust path: */}
          {/* <Route path="/login" element={<Auth />} /> */}
          
          {/* Default home redirect */}
          <Route path="/" element={<Navigate to="/scanner" replace />} />

          {/* ── PROTECTED APP ROUTES ────────────────── */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayoutWrapper />
              </ProtectedRoute>
            }
          >
            {/* ✅ Only routes that exist in your project: */}
            <Route path="scanner" element={<Scanner />} />
            
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
    </Router>
  );
}

export default function App() {
  return <AppContent />;
}
