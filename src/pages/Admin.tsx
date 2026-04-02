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

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"users" | "analytics" | "data" | "settings">("users");
  const [stats, setStats] = useState({ totalUsers: 0, totalParlays: 0, admins: 0, totalPlayers: 0, totalGames: 0 });
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

      setStats({
        totalUsers: merged.length,
        totalParlays: parlayCount || 0,
        admins: merged.filter((u) => u.role === "admin").length,
        totalPlayers: playerCount || 0,
        totalGames: gameCount || 0,
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

    // Upsert: delete old then insert
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

  const handleGenerateProps = async (sport: string) => {
    setIngesting(`props-${sport}`);
    try {
      const result = await sportsApi.generateProps(sport);
      toast.success(`${sport.toUpperCase()} props: ${result?.props_generated || 0} generated`);
    } catch (e: any) {
      toast.error(`Props failed: ${e.message}`);
    } finally {
      setIngesting(null);
    }
  };

  const loadLogs = async () => {
    try {
      const data = await sportsApi.getIngestionLogs();
      setLogs(data || []);
    } catch { /* ignore */ }
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

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Users", value: stats.totalUsers, color: "text-primary" },
            { label: "Admins", value: stats.admins, color: "text-accent" },
            { label: "Parlays", value: stats.totalParlays, color: "text-green-400" },
            { label: "Players", value: stats.totalPlayers, color: "text-blue-400" },
            { label: "Games", value: stats.totalGames, color: "text-yellow-400" },
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
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-foreground">Daily Automation</h3>
                <button onClick={handleRunDaily} disabled={!!ingesting}
                  className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
                  {ingesting === "daily" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Run Full Daily Update
                </button>
              </div>
              <p className="text-sm text-muted-foreground">Fetches teams, rosters, games, injuries, and generates props for all sports.</p>
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
                      <button onClick={() => handleGenerateProps(sport)} disabled={!!ingesting}
                        className="flex items-center gap-1 bg-primary/20 border border-primary/30 px-3 py-1.5 rounded text-xs font-medium text-primary hover:bg-primary/30 disabled:opacity-50">
                        {ingesting === `props-${sport}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <BarChart3 className="w-3 h-3" />}
                        props
                      </button>
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
                { label: "Total Players in DB", value: stats.totalPlayers },
                { label: "Total Games Tracked", value: stats.totalGames },
                { label: "Parlays Created", value: stats.totalParlays },
                { label: "Registered Users", value: stats.totalUsers },
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
