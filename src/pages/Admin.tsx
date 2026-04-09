import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { toast } from "sonner";
import { Shield, Users, BarChart3, Settings, Database, RefreshCw, Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/odds-props";

const SPORTS = ["nba", "nfl", "mlb", "nhl", "soccer"];

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuth();

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProps: 0,
  });

  const [ingesting, setIngesting] = useState<string | null>(null);

  // ✅ LOAD STATS
  const refreshStats = async () => {
    const { count: propsCount } = await supabase
      .from("player_props_cache")
      .select("*", { count: "exact", head: true });

    const { count: userCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    setStats({
      totalUsers: userCount || 0,
      totalProps: propsCount || 0,
    });
  };

  useEffect(() => {
    if (isAdmin) refreshStats();
  }, [isAdmin]);

  // ✅ SYNC ONE SPORT
  const syncSport = async (sport: string) => {
    setIngesting(sport);
    try {
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "sync", sport }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      toast.success(`${sport.toUpperCase()} synced (${data.inserted} props)`);
      await refreshStats();
    } catch (err: any) {
      toast.error(`${sport.toUpperCase()} failed: ${err.message}`);
    } finally {
      setIngesting(null);
    }
  };

  // ✅ SYNC ALL SPORTS
  const syncAll = async () => {
    setIngesting("all");

    try {
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "sync_all" }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      toast.success("All sports synced 🚀");
      await refreshStats();
    } catch (err: any) {
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setIngesting(null);
    }
  };

  // ✅ AUTO SYNC (every 30 mins)
  useEffect(() => {
    if (!isAdmin) return;

    const run = async () => {
      console.log("🔄 Auto syncing...");
      await syncAll();
    };

    run();
    const interval = setInterval(run, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isAdmin]);

  if (authLoading) return <div className="p-10">Loading...</div>;
  if (!isAdmin) return <Navigate to="/scanner" replace />;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">

        {/* HEADER */}
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-6">
          <Shield className="w-6 h-6 text-primary" />
          Admin Panel
        </h1>

        {/* STATS */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-card p-4 rounded-xl">
            <div className="text-sm text-muted-foreground">Users</div>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
          </div>
          <div className="bg-card p-4 rounded-xl">
            <div className="text-sm text-muted-foreground">Props</div>
            <div className="text-2xl font-bold">{stats.totalProps}</div>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="bg-card p-4 rounded-xl mb-6">
          <h3 className="font-bold mb-4">Sync Controls</h3>

          <div className="flex flex-wrap gap-3">

            {SPORTS.map((sport) => (
              <button
                key={sport}
                onClick={() => syncSport(sport)}
                disabled={!!ingesting}
                className="px-4 py-2 bg-secondary rounded-lg text-sm font-semibold hover:bg-secondary/80 flex items-center gap-2"
              >
                {ingesting === sport ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Database className="w-4 h-4" />
                )}
                {sport.toUpperCase()}
              </button>
            ))}

            <button
              onClick={syncAll}
              disabled={!!ingesting}
              className="px-6 py-2 bg-primary text-white rounded-lg font-semibold flex items-center gap-2"
            >
              {ingesting === "all" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Sync ALL
            </button>

          </div>
        </div>

        {/* INFO */}
        <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg text-sm text-green-400">
          ✅ Props are pulled directly from odds-api.io<br />
          ⚡ Combo props (PRA, etc.) are auto-calculated<br />
          🔄 Auto-sync runs every 30 minutes
        </div>

      </div>
    </DashboardLayout>
  );
}
