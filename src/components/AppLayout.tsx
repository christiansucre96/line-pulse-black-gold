// src/components/AppLayout.tsx
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth"; // adjust path if different

interface NavItem {
  path: string;
  label: string;
  adminOnly?: boolean;
  icon: React.ReactNode;
}

const NAV: NavItem[] = [
  {
    path: "/scanner",
    label: "Scanner",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    path: "/parlay",
    label: "Parlay",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    path: "/leaderboard",
    label: "Leaders",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
        <path d="M4 22h16"/>
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
      </svg>
    ),
  },
  {
    path: "/roster",
    label: "Lineups",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    path: "/injuries",
    label: "Injuries",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  {
    path: "/profile",
    label: "Profile",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
  {
    path: "/admin",
    label: "Admin",
    adminOnly: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
  },
]

interface Props { children: React.ReactNode }

export default function AppLayout({ children }: Props) {
  const navigate = useNavigate()
  const location = useLocation()

  // Try to get user role — if useAuth doesn't expose role, admin link shows for all
  // Adjust this based on your actual useAuth hook shape
  let isAdmin = false
  try {
    const auth = useAuth()
    isAdmin = (auth as any)?.user?.role === 'admin' ||
              (auth as any)?.profile?.role === 'admin' ||
              (auth as any)?.isAdmin === true
  } catch { isAdmin = true } // fallback: show admin if hook errors

  const visibleNav = NAV.filter(item => !item.adminOnly || isAdmin)

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#060a0f" }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside style={{
        width: 56,
        background: "#0a0e14",
        borderRight: "1px solid #1a2030",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "12px 0",
        position: "fixed",
        top: 0, left: 0,
        height: "100vh",
        zIndex: 100,
      }}>

        {/* Logo */}
        <div
          onClick={() => navigate("/scanner")}
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #c8970a, #f5bc2f)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 900, color: "#060a0f",
            fontFamily: "'Barlow Condensed', sans-serif",
            marginBottom: 20, cursor: "pointer", flexShrink: 0,
            userSelect: "none",
          }}
        >
          LP
        </div>

        {/* Nav links */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%", flex: 1 }}>
          {visibleNav.map((item) => {
            const active   = location.pathname === item.path
            const isInjury = item.path === "/injuries"
            const isAdminLink = item.path === "/admin"
            const activeColor = isInjury ? "#ff4444" : isAdminLink ? "#a855f7" : "#f5bc2f"
            const activeBg    = isInjury ? "#1a000018" : isAdminLink ? "#1a001a18" : "#1a120018"

            return (
              <div
                key={item.path}
                style={{ position: "relative", width: "100%" }}
                className="lp-nav-item"
              >
                <button
                  onClick={() => navigate(item.path)}
                  title={item.label}
                  style={{
                    width: "100%",
                    padding: "11px 0",
                    background: active ? activeBg : "transparent",
                    border: "none",
                    borderLeft: `2px solid ${active ? activeColor : "transparent"}`,
                    color: active ? activeColor : "#2e3748",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.color = "#64748b"
                      e.currentTarget.style.background = "#141820"
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      e.currentTarget.style.color = "#2e3748"
                      e.currentTarget.style.background = "transparent"
                    }
                  }}
                >
                  {item.icon}
                </button>

                {/* Tooltip */}
                <div className="lp-tooltip" style={{
                  position: "absolute",
                  left: 62, top: "50%",
                  transform: "translateY(-50%)",
                  background: "#141820",
                  border: "1px solid #1e2530",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 11, fontWeight: 700,
                  color: "#94a3b8",
                  fontFamily: "'DM Mono', monospace",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  opacity: 0,
                  transition: "opacity 0.12s",
                  zIndex: 200,
                }}>
                  {item.label}
                </div>
              </div>
            )
          })}
        </div>

        {/* Bottom: sign out */}
        <button
          onClick={() => navigate("/auth")}
          title="Sign out"
          style={{
            padding: "10px 0", width: "100%",
            background: "transparent", border: "none",
            color: "#1e2530", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "color 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
          onMouseLeave={e => e.currentTarget.style.color = "#1e2530"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </aside>

      {/* ── Page content ──────────────────────────────────────────────────── */}
      <main style={{ marginLeft: 56, flex: 1, minWidth: 0 }}>
        {children}
      </main>

      <style>{`
        .lp-nav-item:hover .lp-tooltip { opacity: 1 !important; }
      `}</style>
    </div>
  )
}
