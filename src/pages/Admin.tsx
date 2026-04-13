// src/pages/Admin.tsx
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { toast } from "sonner";
import { Shield, Database, RefreshCw, Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";
const SPORTS = ["nba", "nfl", "mlb", "nhl", "soccer"];

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({ totalUsers: 0, totalProps: 0 });
  const [ingesting, setIngesting] = useState<string | null>(null);

  const refreshStats = async () => {
    try {
      const { count: propsCount } = await supabase.from("player_props_cache").select("*", { count: "exact", head: true });
      const { count: userCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      setStats({ totalUsers: userCount || 0, totalProps: propsCount || 0 });
    } catch (err) { console.error("Failed to load stats:", err); }
  };

  useEffect(() => { if (isAdmin) refreshStats(); }, [isAdmin]);

  const syncSport = async (sport: string) => {
    setIngesting(sport);
    try {
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ operation: "sync_sport", sport }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Sync failed");
      toast.success(`${sport.toUpperCase()} synced successfully`);
      await refreshStats();
    } catch (err: any) {
      console.error("Sync error:", err);
      toast.error(`${sport.toUpperCase()} failed: ${err.message}`);
    } finally { setIngesting(null); }
  };

  const syncAll = async () => {
    setIngesting("all");
    try {
      for (const sport of SPORTS) await syncSport(sport);
      toast.success("All sports synced 🚀");
    } catch (err: any) { toast.error(`Sync failed: ${err.message}`); }
    finally { setIngesting(null); }
  };

  if (authLoading) return <div className="p-10 text-center text-yellow-400">Loading...</div>;
  if (!isAdmin) return <Navigate to="/scanner" replace />;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-6 text-yellow-400">
          <Shield className="w-6 h-6" /> Admin Panel
        </h1>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#0b1120] p-4 rounded-xl border border-gray-800">
            <div className="text-sm text-gray-400">Users</div>
            <div className="text-2xl font-bold text-yellow-400">{stats.totalUsers}</div>
          </div>
          <div className="bg-[#0b1120] p-4 rounded-xl border border-gray-800">
            <div className="text-sm text-gray-400">Cached Props</div>
            <div className="text-2xl font-bold text-yellow-400">{stats.totalProps}</div>
          </div>
        </div>

        <div className="bg-[#0b1120] p-4 rounded-xl mb-6 border border-gray-800">
          <h3 className="font-bold mb-4 text-yellow-400">Sync Controls</h3>
          <div className="flex flex-wrap gap-3">
            {SPORTS.map((sport) => (
              <button key={sport} onClick={() => syncSport(sport)} disabled={!!ingesting}
                className="px-4 py-2 bg-[#1e293b] hover:bg-[#334155] rounded-lg text-sm font-semibold flex items-center gap-2 text-white disabled:opacity-50 transition">
                {ingesting === sport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                {sport.toUpperCase()}
              </button>
            ))}
            <button onClick={syncAll} disabled={!!ingesting}
              className="px-6 py-2 bg-yellow-500 text-black rounded-lg font-semibold flex items-center gap-2 hover:bg-yellow-600 disabled:opacity-50 transition">
              {ingesting === "all" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync ALL
            </button>
          </div>
        </div>

        <div className="bg-green-900/20 border border-green-800 p-4 rounded-lg text-sm text-green-400">
          ✅ Live data from official APIs<br />
          ⚡ Combo props (PRA, etc.) auto-calculated<br />
          🔄 Manual sync only (auto-sync disabled)
        </div>
      </div>
    </DashboardLayout>
  );
}
