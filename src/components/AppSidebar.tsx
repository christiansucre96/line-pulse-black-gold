// src/components/AppSidebar.tsx
import { BarChart3, Layers, Trophy, Users, Bandage, User, Shield, LogOut, LogIn } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { icon: BarChart3, label: "Props", path: "/scanner" },
  { icon: Layers, label: "Parlay", path: "/parlay" },
  { icon: Trophy, label: "Leaders", path: "/leaderboard" },
  { icon: Users, label: "Rosters", path: "/roster" },
  { icon: Bandage, label: "Injuries", path: "/injuries" },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const { user, isAdmin, signOut } = useAuth();

  return (
    <nav className="fixed left-0 top-0 h-screen w-[72px] bg-card border-r border-border flex flex-col items-center py-4 gap-2 z-50">
      <Link to="/" className="w-11 h-11 rounded-full bg-gradient-gold flex items-center justify-center mb-4 shrink-0">
        <span className="font-display text-sm font-bold text-primary-foreground">LP</span>
      </Link>

      {navItems.map((item) => {
        const active = pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            title={item.label}
            className={`w-11 h-11 rounded-lg flex items-center justify-center transition-all ${
              active ? "bg-gradient-gold text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <item.icon size={20} />
          </Link>
        );
      })}

      {isAdmin && (
        <Link
          to="/admin"
          title="Admin"
          className={`w-11 h-11 rounded-lg flex items-center justify-center transition-all ${
            pathname === "/admin" ? "bg-gradient-gold text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          <Shield size={20} />
        </Link>
      )}

      <div className="mt-auto flex flex-col items-center gap-2">
        {user ? (
          <>
            <Link
              to="/profile"
              title="Profile"
              className={`w-11 h-11 rounded-lg flex items-center justify-center transition-all ${
                pathname === "/profile" ? "bg-gradient-gold text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <User size={20} />
            </Link>
            <button
              onClick={signOut}
              title="Sign Out"
              className="w-11 h-11 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-all"
            >
              <LogOut size={20} />
            </button>
          </>
        ) : (
          <Link
            to="/auth"
            title="Sign In"
            className="w-11 h-11 rounded-lg flex items-center justify-center text-primary hover:bg-primary/20 transition-all"
          >
            <LogIn size={20} />
          </Link>
        )}
      </div>
    </nav>
  );
}
