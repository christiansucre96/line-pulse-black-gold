import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { toast } from "sonner";
import { Shield, Users, BarChart3, Settings, Trash2 } from "lucide-react";
import { Navigate } from "react-router-dom";

interface UserRow {
  user_id: string;
  display_name: string | null;
  created_at: string;
  role: string;
}

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"users" | "analytics" | "settings">("users");
  const [stats, setStats] = useState({ totalUsers: 0, totalParlays: 0, admins: 0 });

  useEffect(() => {
    if (!user || !isAdmin) return;
    const fetchData = async () => {
      // Fetch profiles + roles
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, created_at");
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");

      const roleMap = new Map<string, string>();
      roles?.forEach((r) => roleMap.set(r.user_id, r.role));

      const merged: UserRow[] = (profiles || []).map((p) => ({
        user_id: p.user_id,
        display_name: p.display_name,
        created_at: p.created_at,
        role: roleMap.get(p.user_id) || "user",
      }));

      setUsers(merged);
      setStats({
        totalUsers: merged.length,
        totalParlays: 0,
        admins: merged.filter((u) => u.role === "admin").length,
      });

      // Count parlays
      const { count } = await supabase.from("saved_parlays").select("*", { count: "exact", head: true });
      setStats((s) => ({ ...s, totalParlays: count || 0 }));

      setLoading(false);
    };
    fetchData();
  }, [user, isAdmin]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole as any })
      .eq("user_id", userId);
    if (error) {
      toast.error("Failed to update role");
    } else {
      setUsers((u) => u.map((x) => (x.user_id === userId ? { ...x, role: newRole } : x)));
      toast.success("Role updated");
    }
  };

  if (authLoading) return <DashboardLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div></DashboardLayout>;
  if (!isAdmin) return <Navigate to="/scanner" replace />;

  const tabItems = [
    { key: "users" as const, label: "User Management", icon: Users },
    { key: "analytics" as const, label: "Analytics", icon: BarChart3 },
    { key: "settings" as const, label: "Settings", icon: Settings },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-display font-bold text-foreground mb-6 flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" /> Admin Dashboard
        </h1>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: "Total Users", value: stats.totalUsers, color: "text-primary" },
            { label: "Total Parlays", value: stats.totalParlays, color: "text-green-400" },
            { label: "Admins", value: stats.admins, color: "text-accent" },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <div className="text-sm text-muted-foreground">{s.label}</div>
              <div className={`text-3xl font-display font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border">
          {tabItems.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 font-semibold text-sm transition-colors ${
                activeTab === tab.key ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
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
                      <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.user_id} className="border-b border-border/50 hover:bg-secondary/20">
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground">{u.display_name || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">{u.user_id.slice(0, 8)}...</div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="py-3 px-4">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.user_id, e.target.value)}
                            className="bg-secondary border border-border rounded px-2 py-1 text-sm text-foreground focus:ring-2 focus:ring-primary"
                          >
                            <option value="user">User</option>
                            <option value="moderator">Moderator</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            u.role === "admin" ? "bg-primary/20 text-primary" : u.role === "moderator" ? "bg-accent/20 text-accent" : "bg-secondary text-muted-foreground"
                          }`}>
                            {u.role}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-display font-bold text-foreground mb-4">Platform Analytics</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Active Users (24h)", value: stats.totalUsers },
                { label: "Parlays Created", value: stats.totalParlays },
                { label: "Most Popular Sport", value: "NBA" },
                { label: "Avg Parlay Legs", value: "3.2" },
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
                { label: "Maintenance Mode", desc: "Temporarily disable the site for maintenance" },
                { label: "New User Registration", desc: "Allow new users to create accounts" },
                { label: "Email Notifications", desc: "Send email notifications for parlay results" },
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
