import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { sportsApi } from "@/lib/api/sportsApi";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { toast } from "sonner";
import { Shield, Users, BarChart3, Settings, Database, Play, RefreshCw, Loader2, UserPlus, Clock } from "lucide-react";
import { Navigate } from "react-router-dom";

interface UserRow {
  user_id: string;
  display_name: string | null;
  created_at: string;
  role: string;
  subscription?: { plan: string; expires_at: string | null; is_lifetime: boolean } | null;
}

const PLAN_OPTIONS = [
  { value: "7_days", label: "7 Days", days: 7 },
  { value: "30_days", label: "30 Days", days: 30 },
  { value: "90_days", label: "90 Days", days: 90 },
  { value: "1_year", label: "1 Year", days: 365 },
  { value: "lifetime", label: "Lifetime", days: 0 },
];

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"users" | "analytics" | "data" | "settings">("users");
  const [stats, setStats] = useState({ totalUsers: 0, totalParlays: 0, admins: 0, totalPlayers: 0, totalGames: 0, totalTeams: 0 });
  const [ingesting, setIngesting] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    const fetchData = async () => {
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, created_at");
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const { data: subs } = await supabase.from("user_subscriptions" as any).select("user_id, plan, expires_at, is_lifetime");

      const roleMap = new Map<string, string>();
      roles?.forEach((r) => roleMap.set(r.user_id, r.role));

      const subMap = new Map<string, any>();
      (subs as any[] || []).forEach((s: any) => subMap.set(s.user_id, s));

      const merged: UserRow[] = (profiles || []).map((p) => ({
        user_id: p.user_id,
        display_name: p.display_name,
        created_at: p.created_at,
        role: roleMap.get(p.user_id) || "user",
        subscription: subMap.get(p.user_id) || null,
      }));
      setUsers(merged);

      const { count: parlayCount } = await supabase.from("saved_parlays").select("*", { count: "exact", head: true });
      const { count: playerCount } = await supabase.from("players").select("*", { count: "exact", head: true });
      const { count: gameCount } = await supabase.from("games_data").select("*", { count: "exact", head: true });
      const { count: teamCount } = await supabase.from("teams").select("*", { count: "exact", head: true });

      setStats({
        totalUsers: merged.length,
        totalParlays: parlayCount || 0,
        admins: merged.filter((u) => u.role === "admin").length,
        totalPlayers: playerCount || 0,
        totalGames: gameCount || 0,
        totalTeams: teamCount || 0,
      });
      setLoading(false);
    };
    fetchData();
  }, [user, isAdmin]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    const { error } = await supabase.from("user_roles").update({ role: newRole as any }).eq("user_id", userId);
    if (error) toast.error("Failed to update role");
    else {
      setUsers((u) => u.map((x) => (x.user_id === userId ? { ...x, role: newRole } : x)));
      toast.success("Role updated");
    }
  };

  const handleGrantAccess = async (userId: string, planValue: string) => {
    const plan = PLAN_OPTIONS.find((p) => p.value === planValue);
    if (!plan) return;

    const isLifetime = plan.value === "lifetime";
    const expiresAt = isLifetime ? null : new Date(Date.now() + plan.days * 86400000).toISOString();

    await supabase.from("user_subscriptions" as any).delete().eq("user_id", userId);
    const { error } = await supabase.from("user_subscriptions" as any).insert({
      user_id: userId,
      plan: plan.value,
      expires_at: expiresAt,
      is_lifetime: isLifetime,
      granted_by: user?.id,
    } as any);

    if (error) {
      toast.error("Failed to grant access");
    } else {
      setUsers((u) =>
        u.map((x) =>
          x.user_id === userId
            ? { ...x, subscription: { plan: plan.value, expires_at: expiresAt, is_lifetime: isLifetime } }
            : x
        )
      );
      toast.success(`Granted ${plan.label} access`);
    }
  };

  const getSubStatus = (sub: UserRow["subscription"]) => {
    if (!sub) return { label: "No Plan", color: "bg-muted text-muted-foreground" };
    if (sub.is_lifetime) return { label: "Lifetime", color: "bg-primary/20 text-primary" };
    if (sub.expires_at && new Date(sub.expires_at) > new Date()) {
      const days = Math.ceil((new Date(sub.expires_at).getTime() - Date.now()) / 86400000);
      return { label: `${days}d left`, color: "bg-green-500/20 text-green-400" };
    }
    return { label: "Expired", color: "bg-red-500/20 text-red-400" };
  };

  const handleIngest = async (sport: string, operation: string) => {
    const key = `${sport}-${operation}`;
    setIngesting(key);
    try {
      const result = await sportsApi.ingest(sport, operation);
      toast.success(`${sport.toUpperCase()} ${operation}: ${result?.records || 0} records`);
      loadLogs();
    } catch (e: any) {
      toast.error(`Ingestion failed: ${e.message}`);
    } finally {
      setIngesting(null);
    }
  };

  const handleRunDaily = async () => {
    setIngesting("daily");
    try {
      await sportsApi.runDailyAutomation();
      toast.success("Daily automation completed!");
      loadLogs();
    } catch (e: any) {
      toast.error(`Daily run failed: ${e.message}`);
    } finally {
      setIngesting(null);
    }
  };

  const handleFullSystemSync = async () => {
    setIngesting("fullSync");
    try {
      const result = await sportsApi.fullSystemSync();
      console.log("Full system sync result:", result);
      toast.success("Full system sync completed for all sports!");
      loadLogs();
    } catch (e: any) {
      toast.error(`Full sync failed: ${e.message}`);
    } finally {
      setIngesting(null);
    }
  };

  const handleLoadNbaProps = async () => {
    setIngesting("loadProps");
    try {
      const props = await sportsApi.getProps("nba");
      console.log("NBA props:", props);
      toast.success(`Loaded ${props.length} NBA props (check console)`);
    } catch (e: any) {
      toast.error(`Failed to load props: ${e.message}`);
    } finally {
      setIngesting(null);
    }
  };

  const handleGenerateProps = async (sport: string) => {
    setIngesting(`props-${sport}`);
    toast.info(`Generating ${sport.toUpperCase()} props...`);
    try {
      const result = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "props", sport })
      });
      const data = await result.json();
      toast.success(`${sport.toUpperCase()}: ${data.props_generated || 0} props generated`);
      await refreshStats();
    } catch (e: any) {
      toast.error(`Props failed: ${e.message}`);
    } finally {
      setIngesting(null);
    }
  };

  const handleGenerateAllProps = async () => {
    setIngesting("all-props");
    toast.info("Generating props for ALL sports...");
    const sports = ["nba", "nfl", "mlb", "nhl", "soccer"];
    let total = 0;
    
    for (const sport of sports) {
      try {
        const result = await fetch(EDGE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation: "props", sport })
        });
        const data = await result.json();
        total += data.props_generated || 0;
        toast.success(`${sport.toUpperCase()}: ${data.props_generated || 0} props`);
      } catch (err: any) {
        toast.error(`${sport.toUpperCase()} props failed: ${err.message}`);
      }
    }
    
    toast.success(`Total props generated: ${total}`);
    await refreshStats();
    setIngesting(null);
  };

  const handleFullSyncWithProps = async () => {
    setIngesting("full-sync");
    toast.info("Running full sync with props generation...");
    const sports = ["nba", "nfl", "mlb", "nhl", "soccer"];
    
    for (const sport of sports) {
      toast.info(`Syncing ${sport.toUpperCase()}...`);
      try {
        const result = await fetch(EDGE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation: "full_sync", sport })
        });
        const data = await result.json();
        toast.success(`${sport.toUpperCase()}: ${data.props_generated || 0} props`);
      } catch (err: any) {
        toast.error(`${sport.toUpperCase()} failed: ${err.message}`);
      }
    }
    
    await refreshStats();
    toast.success("Full sync complete!");
    setIngesting(null);
  };

  const loadLogs = async () => {
    try {
      const data = await sportsApi.getIngestionLogs();
      setLogs(data || []);
    } catch { /* ignore */ }
  };

  const refreshStats = async () => {
    const { count: playerCount } = await supabase.from("players").select("*", { count: "exact", head: true });
    const { count: gameCount } = await supabase.from("games_data").select("*", { count: "exact", head: true });
    const { count: teamCount } = await supabase.from("teams").select("*", { count: "exact", head: true });
    const { count: propsCount } = await supabase.from("player_props").select("*", { count: "exact", head: true });
    setStats(prev => ({ 
      ...prev, 
      totalPlayers: playerCount || 0, 
      totalGames: gameCount || 0,
      totalTeams: teamCount || 0,
      totalProps: propsCount || 0
    }));
  };

  // AUTO-SYNC EVERY 30 MINUTES
  useEffect(() => {
    if (!isAdmin) return;
    
    const autoSync = async () => {
      console.log("🔄 Auto-syncing sports data (30 min interval)...");
      const sports = ["nba", "nfl", "mlb", "nhl", "soccer"];
      
      for (const sport of sports) {
        try {
          await fetch(EDGE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation: "full_sync", sport })
          });
          console.log(`✅ Auto-sync complete for ${sport}`);
        } catch (err) {
          console.error(`❌ Auto-sync failed for ${sport}:`, err);
        }
      }
      
      await refreshStats();
      console.log("✅ Auto-sync cycle complete");
    };
    
    // Run every 30 minutes
    const interval = setInterval(autoSync, 30 * 60 * 1000);
    
    // Also run once when page loads
    autoSync();
    
    return () => clearInterval(interval);
  }, [isAdmin]);

  // DIRECT SYNC FUNCTIONS
  const syncSportDirect = async (sport: string) => {
    const sportConfig: Record<string, { path: string; name: string }> = {
      nba: { path: "basketball/nba", name: "NBA" },
      nfl: { path: "football/nfl", name: "NFL" },
      mlb: { path: "baseball/mlb", name: "MLB" },
      nhl: { path: "hockey/nhl", name: "NHL" },
      soccer: { path: "soccer/eng.1", name: "Soccer" },
    };

    const config = sportConfig[sport];
    if (!config) throw new Error(`Unknown sport: ${sport}`);

    console.log(`🔄 Syncing ${config.name}...`);

    const teamsRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${config.path}/teams`);
    const teamsJson = await teamsRes.json();
    const teams = teamsJson.sports?.[0]?.leagues?.[0]?.teams?.map((t: any) => ({
      external_id: t.team.id,
      sport: sport,
      name: t.team.displayName,
      abbreviation: t.team.abbreviation,
      logo_url: t.team.logos?.[0]?.href || null,
    })) || [];

    if (teams.length) {
      await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "teams", data: teams })
      });
      console.log(`✅ ${config.name} teams: ${teams.length}`);
    }

    let allPlayers: any[] = [];
    for (const t of teams) {
      try {
        const rosterRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${config.path}/teams/${t.external_id}/roster`);
        const rosterJson = await rosterRes.json();
        const athletes = rosterJson.athletes?.flatMap((g: any) => g.items || []) || rosterJson.athletes || [];
        
        const players = athletes.map((p: any) => ({
          external_id: p.id,
          sport: sport,
          full_name: p.fullName || p.displayName,
          position: p.position?.abbreviation || null,
          headshot_url: p.headshot?.href || null,
        }));
        allPlayers.push(...players);
      } catch (e) {
        console.log(`  Error for team ${t.abbreviation}`);
      }
      await new Promise(r => setTimeout(r, 50));
    }

    console.log(`✅ ${config.name} players: ${allPlayers.length}`);
    
    for (let i = 0; i < allPlayers.length; i += 500) {
      const batch = allPlayers.slice(i, i + 500);
      await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "players", data: batch })
      });
    }

    const gamesRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${config.path}/scoreboard`);
    const gamesJson = await gamesRes.json();
    const games = gamesJson.events?.map((g: any) => ({
      external_id: g.id,
      sport: sport,
      game_date: new Date().toISOString().split('T')[0],
      start_time: g.date,
      status: g.status?.type?.name || "upcoming",
    })) || [];

    if (games.length) {
      await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "games", data: games })
      });
      console.log(`✅ ${config.name} games: ${games.length}`);
    }

    return { teams: teams.length, players: allPlayers.length, games: games.length };
  };

  const syncAllSportsDirect = async () => {
    const sports = ["nba", "nfl", "mlb", "nhl", "soccer"];
    const results: any = {};
    
    for (const sport of sports) {
      try {
        const result = await syncSportDirect(sport);
        results[sport] = result;
      } catch (err: any) {
        results[sport] = { error: err.message };
      }
    }
    
    await refreshStats();
    return results;
  };

  useEffect(() => {
    if (activeTab === "data" && isAdmin) loadLogs();
  }, [activeTab, isAdmin]);

  if (authLoading) return <DashboardLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div></DashboardLayout>;
  if (!isAdmin) return <Navigate to="/scanner" replace />;

  const tabItems = [
    { key: "users" as const, label: "Users", icon: Users },
    { key: "data" as const, label: "Data Management", icon: Database },
    { key: "analytics" as const, label: "Analytics", icon: BarChart3 },
    { key: "settings" as const, label: "Settings", icon: Settings },
  ];

  const sports = ["nba", "mlb", "nhl", "nfl", "soccer"];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-display font-bold text-foreground mb-6 flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" /> Admin Dashboard
        </h1>

        <div className="grid grid-cols-2 sm:grid-cols-7 gap-3 mb-6">
          {[
            { label: "Users", value: stats.totalUsers, color: "text-primary" },
            { label: "Admins", value: stats.admins, color: "text-accent" },
            { label: "Parlays", value: stats.totalParlays, color: "text-green-400" },
            { label: "Teams", value: stats.totalTeams, color: "text-purple-400" },
            { label: "Players", value: stats.totalPlayers, color: "text-blue-400" },
            { label: "Games", value: stats.totalGames, color: "text-yellow-400" },
            { label: "Props", value: (stats as any).totalProps || 0, color: "text-pink-400" },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-3">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className={`text-2xl font-display font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-6 border-b border-border overflow-x-auto">
          {tabItems.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 font-semibold text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.key ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              }`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "users" && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading users...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">User</th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Joined</th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Role</th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Subscription</th>
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Grant Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const subStatus = getSubStatus(u.subscription);
                      return (
                        <tr key={u.user_id} className="border-b border-border/50 hover:bg-secondary/20">
                          <td className="py-3 px-4">
                            <div className="font-medium text-foreground">{u.display_name || "Unknown"}</div>
                            <div className="text-xs text-muted-foreground">{u.user_id.slice(0, 8)}...</div>
                           </td>
                          <td className="py-3 px-4 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                          <td className="py-3 px-4">
                            <select value={u.role} onChange={(e) => handleRoleChange(u.user_id, e.target.value)}
                              className="bg-secondary border border-border rounded px-2 py-1 text-sm text-foreground">
                              <option value="user">User</option>
                              <option value="moderator">Moderator</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${subStatus.color}`}>
                              {subStatus.label}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) handleGrantAccess(u.user_id, e.target.value);
                                e.target.value = "";
                              }}
                              className="bg-secondary border border-border rounded px-2 py-1 text-sm text-foreground"
                            >
                              <option value="" disabled>Add plan...</option>
                              {PLAN_OPTIONS.map((p) => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "data" && (
          <div className="space-y-6">
            {/* PROPS GENERATION SECTION */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-display font-bold text-foreground mb-4">🎲 Props Generation</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Generate player prop lines from historical stats. Click "Generate ALL Props" to create props for all sports.
              </p>
              
              <div className="flex flex-wrap gap-3 mb-4">
                <button
                  onClick={() => handleGenerateProps("nba")}
                  disabled={!!ingesting}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
                >
                  {ingesting === "props-nba" ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                  Generate NBA Props
                </button>
                
                <button
                  onClick={() => handleGenerateProps("nfl")}
                  disabled={!!ingesting}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700"
                >
                  {ingesting === "props-nfl" ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                  Generate NFL Props
                </button>
                
                <button
                  onClick={() => handleGenerateProps("mlb")}
                  disabled={!!ingesting}
                  className="flex items-center gap-2 bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-yellow-700"
                >
                  {ingesting === "props-mlb" ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                  Generate MLB Props
                </button>
                
                <button
                  onClick={() => handleGenerateProps("nhl")}
                  disabled={!!ingesting}
                  className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-700"
                >
                  {ingesting === "props-nhl" ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                  Generate NHL Props
                </button>
                
                <button
                  onClick={() => handleGenerateProps("soccer")}
                  disabled={!!ingesting}
                  className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-purple-700"
                >
                  {ingesting === "props-soccer" ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                  Generate Soccer Props
                </button>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleGenerateAllProps}
                  disabled={!!ingesting}
                  className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:from-green-700 hover:to-blue-700"
                >
                  {ingesting === "all-props" ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                  Generate ALL Props
                </button>
                
                <button
                  onClick={handleFullSyncWithProps}
                  disabled={!!ingesting}
                  className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-purple-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:from-red-700 hover:to-purple-700"
                >
                  {ingesting === "full-sync" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  🔥 Full Sync + Props (One Click)
                </button>
              </div>
              
              <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-xs text-green-400">
                  🤖 Auto-sync runs every 30 minutes automatically. Props are generated from player stats.
                  Click "Generate ALL Props" to create prop lines for all sports now.
                </p>
              </div>
            </div>

            {/* Quick Admin Actions */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-display font-bold text-foreground mb-4">⚡ Quick Admin Actions</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleFullSystemSync}
                  disabled={!!ingesting}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
                >
                  {ingesting === "fullSync" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Run Full Sync
                </button>
                <button
                  onClick={handleRunDaily}
                  disabled={!!ingesting}
                  className="flex items-center gap-2 bg-accent text-accent-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent/90 disabled:opacity-50"
                >
                  {ingesting === "daily" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Run Daily (All Sports)
                </button>
                <button
                  onClick={handleLoadNbaProps}
                  disabled={!!ingesting}
                  className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-secondary/80 disabled:opacity-50"
                >
                  {ingesting === "loadProps" ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                  Load NBA Props (Console)
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Full Sync = all sports (teams, players, games, injuries, live, boxscores, props). Daily = standard daily pipeline.
              </p>
            </div>

            {/* ESPN DATA SYNC SECTION */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-display font-bold text-foreground mb-4">📡 ESPN Data Sync</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Fetches live data directly from ESPN and saves to database.
              </p>
              
              <div className="flex flex-wrap gap-3 mb-4">
                <button
                  onClick={async () => {
                    setIngesting("sync-nba");
                    toast.info("Syncing NBA data...");
                    try {
                      const result = await syncSportDirect("nba");
                      toast.success(`NBA: ${result.teams} teams, ${result.players} players`);
                      await refreshStats();
                    } catch (err: any) {
                      toast.error(`NBA sync failed: ${err.message}`);
                    } finally {
                      setIngesting(null);
                    }
                  }}
                  disabled={!!ingesting}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
                >
                  {ingesting === "sync-nba" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  Sync NBA
                </button>

                <button
                  onClick={async () => {
                    setIngesting("sync-nfl");
                    toast.info("Syncing NFL data...");
                    try {
                      const result = await syncSportDirect("nfl");
                      toast.success(`NFL: ${result.teams} teams, ${result.players} players`);
                      await refreshStats();
                    } catch (err: any) {
                      toast.error(`NFL sync failed: ${err.message}`);
                    } finally {
                      setIngesting(null);
                    }
                  }}
                  disabled={!!ingesting}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700"
                >
                  {ingesting === "sync-nfl" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  Sync NFL
                </button>

                <button
                  onClick={async () => {
                    setIngesting("sync-mlb");
                    toast.info("Syncing MLB data...");
                    try {
                      const result = await syncSportDirect("mlb");
                      toast.success(`MLB: ${result.teams} teams, ${result.players} players`);
                      await refreshStats();
                    } catch (err: any) {
                      toast.error(`MLB sync failed: ${err.message}`);
                    } finally {
                      setIngesting(null);
                    }
                  }}
                  disabled={!!ingesting}
                  className="flex items-center gap-2 bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-yellow-700"
                >
                  {ingesting === "sync-mlb" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  Sync MLB
                </button>

                <button
                  onClick={async () => {
                    setIngesting("sync-nhl");
                    toast.info("Syncing NHL data...");
                    try {
                      const result = await syncSportDirect("nhl");
                      toast.success(`NHL: ${result.teams} teams, ${result.players} players`);
                      await refreshStats();
                    } catch (err: any) {
                      toast.error(`NHL sync failed: ${err.message}`);
                    } finally {
                      setIngesting(null);
                    }
                  }}
                  disabled={!!ingesting}
                  className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-700"
                >
                  {ingesting === "sync-nhl" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  Sync NHL
                </button>

                <button
                  onClick={async () => {
                    setIngesting("sync-soccer");
                    toast.info("Syncing Soccer data...");
                    try {
                      const result = await syncSportDirect("soccer");
                      toast.success(`Soccer: ${result.teams} teams, ${result.players} players`);
                      await refreshStats();
                    } catch (err: any) {
                      toast.error(`Soccer sync failed: ${err.message}`);
                    } finally {
                      setIngesting(null);
                    }
                  }}
                  disabled={!!ingesting}
                  className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-purple-700"
                >
                  {ingesting === "sync-soccer" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  Sync Soccer
                </button>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={async () => {
                    setIngesting("sync-all");
                    toast.info("Syncing ALL sports (this may take 2-3 minutes)...");
                    try {
                      await syncAllSportsDirect();
                      toast.success("All sports synced successfully!");
                      await refreshStats();
                    } catch (err: any) {
                      toast.error(`Sync failed: ${err.message}`);
                    } finally {
                      setIngesting(null);
                    }
                  }}
                  disabled={!!ingesting}
                  className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-purple-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:from-red-700 hover:to-purple-700"
                >
                  {ingesting === "sync-all" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                  🔥 Sync ALL Sports
                </button>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-display font-bold text-foreground mb-4">Sport-Specific Ingestion</h3>
              <div className="space-y-3">
                {sports.map((sport) => (
                  <div key={sport} className="flex items-center justify-between bg-secondary/30 rounded-lg p-3">
                    <span className="font-semibold text-foreground uppercase">{sport}</span>
                    <div className="flex gap-2 flex-wrap">
                      {["teams", "players", "games", "full"].map((op) => (
                        <button key={op} onClick={() => handleIngest(sport, op)} disabled={!!ingesting}
                          className="flex items-center gap-1 bg-secondary border border-border px-3 py-1.5 rounded text-xs font-medium text-foreground hover:bg-accent/20 disabled:opacity-50">
                          {ingesting === `${sport}-${op}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          {op}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-display font-bold text-foreground mb-4">Recent Ingestion Logs</h3>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No logs yet. Run an ingestion to see results.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-muted-foreground">Sport</th>
                        <th className="text-left py-2 px-3 text-muted-foreground">Operation</th>
                        <th className="text-left py-2 px-3 text-muted-foreground">Status</th>
                        <th className="text-left py-2 px-3 text-muted-foreground">Records</th>
                        <th className="text-left py-2 px-3 text-muted-foreground">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.slice(0, 15).map((log: any) => (
                        <tr key={log.id} className="border-b border-border/30">
                          <td className="py-2 px-3 uppercase font-medium">{log.sport}</td>
                          <td className="py-2 px-3">{log.operation}</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              log.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                              log.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                            }`}>{log.status}</span>
                          </td>
                          <td className="py-2 px-3">{log.records_processed}</td>
                          <td className="py-2 px-3 text-muted-foreground">{new Date(log.started_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-display font-bold text-foreground mb-4">Platform Analytics</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Total Teams in DB", value: stats.totalTeams },
                { label: "Total Players in DB", value: stats.totalPlayers },
                { label: "Total Games Tracked", value: stats.totalGames },
                { label: "Total Props Generated", value: (stats as any).totalProps || 0 },
                { label: "Parlays Created", value: stats.totalParlays },
                { label: "Registered Users", value: stats.totalUsers },
                { label: "Admins", value: stats.admins },
              ].map((item) => (
                <div key={item.label} className="bg-secondary/30 rounded-lg p-4">
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className="text-xl font-bold text-foreground mt-1">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="font-display font-bold text-foreground">Site Settings</h3>
            <div className="space-y-3">
              {[
                { label: "Maintenance Mode", desc: "Temporarily disable the site" },
                { label: "New User Registration", desc: "Allow new users to create accounts" },
                { label: "Email Notifications", desc: "Send notifications for parlay results" },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between bg-secondary/30 rounded-lg p-4">
                  <div>
                    <div className="font-medium text-foreground">{s.label}</div>
                    <div className="text-xs text-muted-foreground">{s.desc}</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-muted peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-foreground after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
