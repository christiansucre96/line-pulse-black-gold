// src/pages/Admin.tsx
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { toast } from "sonner";
import { 
  Shield, Database, RefreshCw, Loader2, Users, DollarSign, 
  Calendar, TrendingUp, UserPlus, Key, Trash2, CheckCircle, 
  XCircle, Clock, Crown, Activity
} from "lucide-react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";
const SPORTS = ["nba", "nfl", "mlb", "nhl", "soccer"];

// Pricing tiers
const PRICING = {
  '7day': { label: '7 Days', price: 9.99, days: 7 },
  '3month': { label: '3 Months', price: 49.99, days: 90 },
  '1year': { label: '1 Year', price: 149.99, days: 365 },
  'permanent': { label: 'Lifetime', price: 299.99, days: null },
};

interface UserWithProfile {
  id: string;
  email: string;
  created_at: string;
  last_login: string | null;
  subscription_tier: string;
  subscription_end: string | null;
  is_active: boolean;
  revenue_generated: number;
}

interface RevenueStats {
  total: number;
  thisMonth: number;
  thisWeek: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
}

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({ totalUsers: 0, totalProps: 0 });
  const [ingesting, setIngesting] = useState<string | null>(null);
  
  // User management state
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [revenue, setRevenue] = useState<RevenueStats>({
    total: 0, thisMonth: 0, thisWeek: 0,
    activeSubscriptions: 0, expiredSubscriptions: 0
  });
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserTier, setNewUserTier] = useState<string>('7day');
  const [tempPassword, setTempPassword] = useState('');

  const refreshStats = async () => {
    try {
      const { count: propsCount } = await supabase.from("player_props_cache").select("*", { count: "exact", head: true });
      const { count: userCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      setStats({ totalUsers: userCount || 0, totalProps: propsCount || 0 });
    } catch (err) { console.error("Failed to load stats:", err); }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      // Fetch all users with profiles
      const {  usersData, error } = await supabase
        .from('profiles')
        .select(`
          id, email, created_at, last_login,
          subscription_tier, subscription_end, is_active, revenue_generated
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setUsers(usersData || []);
      
      // Calculate revenue stats
      const {  revenueData } = await supabase
        .from('revenue_events')
        .select('amount, created_at');
      
      const {  activeSubs } = await supabase
        .from('subscriptions')
        .select('id', { count: 'exact' })
        .eq('status', 'active');
      
      const {  expiredSubs } = await supabase
        .from('subscriptions')
        .select('id', { count: 'exact' })
        .eq('status', 'expired');
      
      const total = revenueData?.reduce((sum, r) => sum + r.amount, 0) || 0;
      const now = new Date();
      const thisMonth = revenueData?.filter(r => {
        const d = new Date(r.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).reduce((sum, r) => sum + r.amount, 0) || 0;
      
      const thisWeek = revenueData?.filter(r => {
        const d = new Date(r.created_at);
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return d >= weekAgo;
      }).reduce((sum, r) => sum + r.amount, 0) || 0;
      
      setRevenue({
        total, thisMonth, thisWeek,
        activeSubscriptions: activeSubs || 0,
        expiredSubscriptions: expiredSubs || 0
      });
    } catch (err) {
      console.error("Failed to load users:", err);
      toast.error("Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  };

  const addUser = async () => {
    if (!newUserEmail || !tempPassword) {
      toast.error("Email and password required");
      return;
    }
    
    try {
      // Create user in auth
      const {  authUser, error: authError } = await supabase.auth.admin.createUser({
        email: newUserEmail,
        password: tempPassword,
        email_confirm: true,
      });
      
      if (authError) throw authError;
      if (!authUser.user) throw new Error("User creation failed");
      
      // Calculate subscription end date
      const tier = PRICING[newUserTier as keyof typeof PRICING];
      const startDate = new Date();
      const endDate = tier.days 
        ? new Date(startDate.getTime() + tier.days * 24 * 60 * 60 * 1000)
        : null;
      
      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authUser.user.id,
          email: newUserEmail,
          subscription_tier: newUserTier,
          subscription_start: startDate.toISOString(),
          subscription_end: endDate?.toISOString(),
          is_active: true,
        });
      
      if (profileError) throw profileError;
      
      // Create subscription record
      const { error: subError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: authUser.user.id,
          tier: newUserTier,
          amount: tier.price,
          status: 'active',
          start_date: startDate.toISOString(),
          end_date: endDate?.toISOString(),
        });
      
      if (subError) throw subError;
      
      // Record revenue
      await supabase.from('revenue_events').insert({
        user_id: authUser.user.id,
        event_type: 'subscription',
        amount: tier.price,
        description: `Initial subscription: ${tier.label}`,
      });
      
      toast.success(`User created! Temp password: ${tempPassword}`);
      setShowAddUser(false);
      setNewUserEmail('');
      setTempPassword('');
      await loadUsers();
      await refreshStats();
    } catch (err: any) {
      console.error("Add user error:", err);
      toast.error(err.message || "Failed to create user");
    }
  };

  const updateUserSubscription = async (userId: string, tier: string) => {
    try {
      const tierData = PRICING[tier as keyof typeof PRICING];
      const startDate = new Date();
      const endDate = tierData.days
        ? new Date(startDate.getTime() + tierData.days * 24 * 60 * 60 * 1000)
        : null;
      
      // Update profile
      await supabase.from('profiles').update({
        subscription_tier: tier,
        subscription_start: startDate.toISOString(),
        subscription_end: endDate?.toISOString(),
      }).eq('id', userId);
      
      // Create new subscription record
      await supabase.from('subscriptions').insert({
        user_id: userId,
        tier,
        amount: tierData.price,
        status: 'active',
        start_date: startDate.toISOString(),
        end_date: endDate?.toISOString(),
      });
      
      // Record revenue
      await supabase.from('revenue_events').insert({
        user_id: userId,
        event_type: 'subscription',
        amount: tierData.price,
        description: `Subscription upgrade: ${tierData.label}`,
      });
      
      toast.success("Subscription updated");
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to update subscription");
    }
  };

  const toggleUserActive = async (userId: string, currentStatus: boolean) => {
    try {
      await supabase.from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId);
      
      toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'}`);
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to update user");
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    
    try {
      // Delete from auth (admin only)
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;
      
      toast.success("User deleted");
      await loadUsers();
      await refreshStats();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    }
  };

  const isSubscriptionExpired = (endDate: string | null) => {
    if (!endDate) return false; // Permanent
    return new Date(endDate) < new Date();
  };

  useEffect(() => { 
    if (isAdmin) {
      refreshStats();
      loadUsers();
    }
  }, [isAdmin]);

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

  const activeUsers = users.filter(u => u.is_active && !isSubscriptionExpired(u.subscription_end)).length;
  const inactiveUsers = users.length - activeUsers;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-6 text-yellow-400">
          <Shield className="w-6 h-6" /> Admin Panel
        </h1>

        {/* Revenue Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-[#0b1120] border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">${revenue.total.toFixed(2)}</div>
              <p className="text-xs text-gray-500">All time</p>
            </CardContent>
          </Card>
          
          <Card className="bg-[#0b1120] border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">This Month</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400">${revenue.thisMonth.toFixed(2)}</div>
              <p className="text-xs text-gray-500">{revenue.thisWeek > 0 ? `$${revenue.thisWeek.toFixed(2)} this week` : 'No revenue this week'}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-[#0b1120] border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Active Subscriptions</CardTitle>
              <Crown className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-400">{revenue.activeSubscriptions}</div>
              <p className="text-xs text-gray-500">{revenue.expiredSubscriptions} expired</p>
            </CardContent>
          </Card>
        </div>

        {/* User Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#0b1120] p-4 rounded-xl border border-gray-800">
            <div className="text-sm text-gray-400 flex items-center gap-2">
              <Users className="w-4 h-4" /> Total Users
            </div>
            <div className="text-2xl font-bold text-yellow-400">{stats.totalUsers}</div>
          </div>
          <div className="bg-[#0b1120] p-4 rounded-xl border border-gray-800">
            <div className="text-sm text-gray-400 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Active
            </div>
            <div className="text-2xl font-bold text-green-400">{activeUsers}</div>
          </div>
          <div className="bg-[#0b1120] p-4 rounded-xl border border-gray-800">
            <div className="text-sm text-gray-400 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Inactive
            </div>
            <div className="text-2xl font-bold text-red-400">{inactiveUsers}</div>
          </div>
          <div className="bg-[#0b1120] p-4 rounded-xl border border-gray-800">
            <div className="text-sm text-gray-400 flex items-center gap-2">
              <Database className="w-4 h-4" /> Cached Props
            </div>
            <div className="text-2xl font-bold text-yellow-400">{stats.totalProps}</div>
          </div>
        </div>

        {/* Add User Dialog */}
        <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
          <DialogContent className="bg-[#0b1120] border-gray-800 text-white">
            <DialogHeader>
              <DialogTitle className="text-yellow-400 flex items-center gap-2">
                <UserPlus className="w-5 h-5" /> Add New User
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Create a new user with temporary password. User will be prompted to change password on first login.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="bg-[#1e293b] border-gray-700 text-white"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-300">Temporary Password</Label>
                <div className="flex gap-2">
                  <Input
                    id="password"
                    type="text"
                    placeholder="Auto-generate or enter manually"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    className="bg-[#1e293b] border-gray-700 text-white flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setTempPassword(Math.random().toString(36).slice(-8).toUpperCase())}
                    className="border-gray-700 text-gray-300"
                  >
                    <Key className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-gray-300">Subscription Tier</Label>
                <Select value={newUserTier} onValueChange={setNewUserTier}>
                  <SelectTrigger className="bg-[#1e293b] border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1e293b] border-gray-700">
                    {Object.entries(PRICING).map(([key, value]) => (
                      <SelectItem key={key} value={key}>
                        {value.label} - ${value.price}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddUser(false)} className="border-gray-700 text-gray-300">
                Cancel
              </Button>
              <Button onClick={addUser} className="bg-yellow-500 hover:bg-yellow-600 text-black">
                <UserPlus className="w-4 h-4 mr-2" /> Create User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* User Management Table */}
        <Card className="bg-[#0b1120] border-gray-800 mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-yellow-400 flex items-center gap-2">
              <Users className="w-5 h-5" /> User Management
            </CardTitle>
            <Button onClick={() => setShowAddUser(true)} className="bg-yellow-500 hover:bg-yellow-600 text-black">
              <UserPlus className="w-4 h-4 mr-2" /> Add User
            </Button>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <div className="text-center py-8 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                Loading users...
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No users found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">User</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Subscription</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Last Login</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Revenue</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const expired = isSubscriptionExpired(u.subscription_end);
                      const tier = PRICING[u.subscription_tier as keyof typeof PRICING];
                      
                      return (
                        <tr key={u.id} className="border-b border-gray-800/50 hover:bg-[#1e293b]/50">
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-white">{u.email}</div>
                            <div className="text-xs text-gray-500">ID: {u.id.slice(0, 8)}...</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">
                                {tier?.label || u.subscription_tier}
                              </Badge>
                              {u.subscription_end && !expired && (
                                <span className="text-xs text-gray-500">
                                  Ends {new Date(u.subscription_end).toLocaleDateString()}
                                </span>
                              )}
                              {expired && <span className="text-xs text-red-400">Expired</span>}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={u.is_active && !expired ? "default" : "secondary"} 
                                   className={u.is_active && !expired ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                              {u.is_active && !expired ? (
                                <><CheckCircle className="w-3 h-3 mr-1" /> Active</>
                              ) : (
                                <><XCircle className="w-3 h-3 mr-1" /> Inactive</>
                              )}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-400">
                            {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-green-400">
                            ${u.revenue_generated?.toFixed(2) || '0.00'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex justify-end gap-2">
                              <Select
                                value={u.subscription_tier}
                                onValueChange={(value) => updateUserSubscription(u.id, value)}
                              >
                                <SelectTrigger className="w-32 bg-[#1e293b] border-gray-700 text-xs">
                                  <SelectValue placeholder="Change tier" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1e293b] border-gray-700">
                                  {Object.entries(PRICING).map(([key, value]) => (
                                    <SelectItem key={key} value={key}>
                                      {value.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleUserActive(u.id, u.is_active)}
                                className="border-gray-700 text-gray-300"
                              >
                                {u.is_active ? 'Deactivate' : 'Activate'}
                              </Button>
                              
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deleteUser(u.id)}
                                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sync Controls */}
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
