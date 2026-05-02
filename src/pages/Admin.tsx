// src/pages/Admin.tsx
// 🎁 Purpose: Grant FREE trial access to influencers & VIP users

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { toast } from "sonner";
import { 
  Shield, Database, RefreshCw, Loader2, Users, Gift, 
  Clock, Key, CheckCircle, XCircle, ExternalLink, Copy
} from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";
const SPORTS = ["nba", "nfl", "mlb", "nhl", "soccer"];

// 💰 PRICING CONFIGURATION
const PRICING: Record<string, { label: string; days: number; referencePrice: number; note: string }> = {
  '7day': { 
    label: '7 Days', 
    days: 7,
    referencePrice: 35.00,
    note: '1-week influencer trial'
  },
  '1month': { 
    label: '1 Month', 
    days: 30,
    referencePrice: 150.00,
    note: 'Standard monthly access'
  },
  '3month': { 
    label: '3 Months', 
    days: 90,
    referencePrice: 400.00,
    note: 'Quarterly partnership'
  },
  '1year': { 
    label: '1 Year', 
    days: 365,
    referencePrice: 1500.00,
    note: 'Annual ambassador access'
  },
};

const REFERENCE_MONTHLY_RATE = 150.00;

interface UserWithProfile {
  id: string;
  email: string;
  created_at: string;
  last_login: string | null;
  subscription_tier: string;
  subscription_start: string | null;
  subscription_end: string | null;
  is_active: boolean;
  is_free_trial: boolean;
  trial_reason: string | null;
  revenue_generated: number;
}

interface TrialStats {
  totalTrials: number;
  activeTrials: number;
  expiredTrials: number;
  byTier: Record<string, number>;
}

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [stats, setStats] = useState({ totalUsers: 0, totalProps: 0 });
  const [ingesting, setIngesting] = useState<string | null>(null);
  
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [trialStats, setTrialStats] = useState<TrialStats>({
    totalTrials: 0, activeTrials: 0, expiredTrials: 0, byTier: {}
  });
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  const [showAddTrial, setShowAddTrial] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserTier, setNewUserTier] = useState<string>('7day');
  const [tempPassword, setTempPassword] = useState('');
  const [trialReason, setTrialReason] = useState('');
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const refreshStats = async () => {
    try {
      const { count: propsCount } = await supabase.from("player_props_cache").select("*", { count: "exact", head: true });
      const { count: userCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      setStats({ totalUsers: userCount || 0, totalProps: propsCount || 0 });
    } catch (err) { console.error("Failed to load stats:", err); }
  };

  // ✅ UPDATED loadUsers – reads email directly from profiles table
  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data: profilesData, error } = await supabase
        .from('profiles')
        .select(`
          id, email, created_at, last_login,
          subscription_tier, subscription_start, subscription_end,
          is_active, is_free_trial, trial_reason, revenue_generated
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const usersWithEmail = (profilesData || []).map(profile => ({
        ...profile,
        user_id: profile.id,
      }));

      setUsers(usersWithEmail);

      const trials = usersWithEmail.filter(u => u.is_free_trial);
      const now = new Date();

      setTrialStats({
        totalTrials: trials.length,
        activeTrials: trials.filter(u =>
          u.is_active && (!u.subscription_end || new Date(u.subscription_end) > now)
        ).length,
        expiredTrials: trials.filter(u =>
          u.subscription_end && new Date(u.subscription_end) <= now
        ).length,
        byTier: trials.reduce((acc, u) => {
          acc[u.subscription_tier] = (acc[u.subscription_tier] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });
    } catch (err) {
      console.error("Failed to load users:", err);
      toast.error("Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  };

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPassword(true);
      toast.success("Password copied to clipboard");
      setTimeout(() => setCopiedPassword(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  // grantTrial (unchanged – uses the new email from profiles)
  const grantTrial = async () => {
    if (!newUserEmail) {
      toast.error("Email is required");
      return;
    }
    
    const tier = PRICING[newUserTier];
    if (!tier) {
      toast.error("Invalid tier selected");
      return;
    }
    
    try {
      let userId: string;
      
      // 1. Find or Create User
      if (isExistingUser) {
        const { data: authUsers, error: findError } = await supabase
          .from('auth.users')
          .select('id')
          .ilike('email', newUserEmail.toLowerCase());
        
        if (findError || !authUsers || authUsers.length === 0) {
          throw new Error("User not found. Create new user instead.");
        }
        userId = authUsers[0].id;
      } else {
        const password = tempPassword || generateTempPassword();
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: newUserEmail.toLowerCase(),
          password,
          email_confirm: true,
        });
        
        if (authError) throw authError;
        if (!authUser.user) throw new Error("User creation failed");
        
        userId = authUser.user.id;
        setTempPassword(password);
      }
      
      const startDate = new Date();
      const endDate = tier.days 
        ? new Date(startDate.getTime() + tier.days * 24 * 60 * 60 * 1000)
        : null;
      
      // Upsert profile – email is required
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          user_id: userId,
          email: newUserEmail.toLowerCase(),
          subscription_tier: newUserTier,
          subscription_start: startDate.toISOString(),
          subscription_end: endDate?.toISOString(),
          is_active: true,
          is_free_trial: true,
          trial_reason: trialReason || `Influencer trial - ${newUserTier}`,
          trial_granted_by: user?.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      
      if (profileError) throw new Error(`Profile error: ${profileError.message}`);
      
      await supabase.from('subscriptions').delete().eq('user_id', userId);
      
      const { error: subError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          tier: newUserTier,
          amount: 0,
          currency: 'USDT',
          status: 'active',
          start_date: startDate.toISOString(),
          end_date: endDate?.toISOString(),
          is_free_trial: true,
          granted_by: user?.id,
          trial_reason: trialReason,
        });
      
      if (subError) throw new Error(`Subscription error: ${subError.message}`);
      
      await supabase.from('revenue_events').insert({
        user_id: userId,
        event_type: 'subscription',
        amount: 0,
        currency: 'USDT',
        description: `FREE trial: ${tier.label}`,
        is_free_trial: true,
      });
      
      if (!isExistingUser) {
        toast.success(
          <div>
            <div>✅ Trial granted to {newUserEmail}</div>
            <div className="text-xs text-gray-400 mt-1">
              Temp password: <span className="font-mono text-yellow-400">{tempPassword}</span>
              <button 
                onClick={() => copyToClipboard(tempPassword)}
                className="ml-2 text-blue-400 hover:underline"
              >
                {copiedPassword ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>,
          { duration: 8000 }
        );
      } else {
        toast.success(`✅ Trial granted to ${newUserEmail}`);
      }
      
      setShowAddTrial(false);
      setNewUserEmail('');
      setTempPassword('');
      setTrialReason('');
      setIsExistingUser(false);
      
      await loadUsers();
      await refreshStats();
      
    } catch (err: any) {
      console.error("Grant trial error:", err);
      toast.error(err.message || "Failed to grant trial");
    }
  };

  const extendTrial = async (userId: string, additionalDays: number) => {
    try {
      const currentEnd = new Date();
      const newEnd = new Date(currentEnd.getTime() + additionalDays * 24 * 60 * 60 * 1000);
      
      await supabase.from('profiles').update({
        subscription_end: newEnd.toISOString(),
      }).eq('id', userId);
      
      await supabase.from('subscriptions').update({
        end_date: newEnd.toISOString(),
      }).eq('user_id', userId).eq('status', 'active');
      
      toast.success("Trial extended");
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to extend trial");
    }
  };

  const revokeTrial = async (userId: string) => {
    if (!confirm("Revoke this user's trial access?")) return;
    
    try {
      await supabase.from('profiles').update({
        is_active: false,
        subscription_end: new Date().toISOString(),
      }).eq('id', userId);
      
      await supabase.from('subscriptions').update({
        status: 'revoked',
      }).eq('user_id', userId);
      
      toast.success("Trial revoked");
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke trial");
    }
  };

  const isTrialExpired = (endDate: string | null) => {
    if (!endDate) return false;
    return new Date(endDate) < new Date();
  };

  const getTierLabel = (tier: string) => PRICING[tier]?.label || tier;
  const getTierDays = (tier: string) => PRICING[tier]?.days || 0;
  const getReferencePrice = (tier: string) => PRICING[tier]?.referencePrice || 0;

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
  
  // 🔧 TEMPORARY BYPASS - grants admin to your email
  const forceAdmin = user?.email === 'christiansucre1@gmail.com';

  if (!isAdmin && !forceAdmin) {
    return <Navigate to="/scanner" replace />;
  }

  const activeTrials = trialStats.activeTrials;
  const expiredTrials = trialStats.expiredTrials;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-yellow-400">
            <Shield className="w-6 h-6" /> Admin Panel
          </h1>
          <Badge variant="outline" className="border-green-500/50 text-green-400">
            <Gift className="w-3 h-3 mr-1" /> Free Trial Manager
          </Badge>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-[#0b1120] border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <Users className="w-4 h-4" /> Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-[#0b1120] border-green-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-400 flex items-center gap-2">
                <Gift className="w-4 h-4" /> Active Trials
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">{activeTrials}</div>
              <p className="text-xs text-gray-500">{trialStats.totalTrials} total granted</p>
            </CardContent>
          </Card>
          
          <Card className="bg-[#0b1120] border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Expired Trials
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-400">{expiredTrials}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-[#0b1120] border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <Database className="w-4 h-4" /> Cached Props
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-400">{stats.totalProps}</div>
            </CardContent>
          </Card>
        </div>

        {/* Trial Grant Dialog */}
        <Dialog open={showAddTrial} onOpenChange={setShowAddTrial}>
          <DialogContent className="bg-[#0b1120] border-gray-800 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-yellow-400 flex items-center gap-2">
                <Gift className="w-5 h-5" /> Grant Free Trial Access
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Grant complimentary access to influencers, partners, or VIP users. 
                Reference: 1 month = {REFERENCE_MONTHLY_RATE.toFixed(2)} USDT.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="flex gap-4 p-3 bg-[#1e293b] rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input
                    type="radio"
                    name="userType"
                    checked={!isExistingUser}
                    onChange={() => setIsExistingUser(false)}
                    className="text-yellow-500"
                  />
                  <span className="text-sm">✨ Create New User</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input
                    type="radio"
                    name="userType"
                    checked={isExistingUser}
                    onChange={() => setIsExistingUser(true)}
                    className="text-yellow-500"
                  />
                  <span className="text-sm">👤 Existing User</span>
                </label>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300">User Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="influencer@example.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="bg-[#1e293b] border-gray-700 text-white"
                  required
                />
              </div>
              
              {!isExistingUser && (
                <div className="space-y-2">
                  <Label className="text-gray-300">Temporary Password</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Auto-generated"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      className="bg-[#1e293b] border-gray-700 text-white font-mono flex-1"
                      readOnly
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setTempPassword(generateTempPassword())}
                      className="border-gray-700 text-gray-300 shrink-0"
                    >
                      <Key className="w-4 h-4" />
                    </Button>
                    {tempPassword && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => copyToClipboard(tempPassword)}
                        className="border-gray-700 text-blue-400 shrink-0"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">User will change password on first login</p>
                </div>
              )}
              
              <div className="space-y-2">
                <Label className="text-gray-300">Trial Duration</Label>
                <Select value={newUserTier} onValueChange={setNewUserTier}>
                  <SelectTrigger className="bg-[#1e293b] border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1e293b] border-gray-700">
                    {Object.entries(PRICING).map(([key, value]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex justify-between items-center w-full gap-4">
                          <span className="font-medium">{value.label}</span>
                          <span className="text-xs text-gray-500">({value.days} days)</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {value.note} • Ref: {value.referencePrice.toFixed(2)} USDT
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="reason" className="text-gray-300">Trial Reason (Optional)</Label>
                <Textarea
                  id="reason"
                  placeholder="e.g., YouTube influencer, Twitter promo, VIP access..."
                  value={trialReason}
                  onChange={(e) => setTrialReason(e.target.value)}
                  className="bg-[#1e293b] border-gray-700 text-white min-h-[80px]"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddTrial(false)} className="border-gray-700 text-gray-300">
                Cancel
              </Button>
              <Button 
                onClick={grantTrial} 
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                disabled={!newUserEmail}
              >
                <Gift className="w-4 h-4 mr-2" /> Grant FREE Trial
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Trial Management Table */}
        <Card className="bg-[#0b1120] border-gray-800 mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-yellow-400 flex items-center gap-2">
                <Users className="w-5 h-5" /> Trial Users
              </CardTitle>
              <CardDescription className="text-gray-400">
                Manage free trial access
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddTrial(true)} className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold">
              <Gift className="w-4 h-4 mr-2" /> Grant New Trial
            </Button>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <div className="text-center py-8 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                Loading users...
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Gift className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No trial users yet</p>
                <Button 
                  variant="outline" 
                  onClick={() => setShowAddTrial(true)}
                  className="mt-4 border-yellow-500/50 text-yellow-400"
                >
                  Grant First Trial
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">User</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Trial Tier</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Ends</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Reason</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.filter(u => u.is_free_trial).map((u) => {
                      const expired = isTrialExpired(u.subscription_end);
                      const tier = PRICING[u.subscription_tier];
                      
                      return (
                        <tr key={u.id} className="border-b border-gray-800/50 hover:bg-[#1e293b]/50">
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-white">{u.email}</div>
                            <div className="text-xs text-gray-500">
                              {u.last_login ? `Last: ${new Date(u.last_login).toLocaleDateString()}` : 'Never logged in'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">
                                {tier?.label || u.subscription_tier}
                              </Badge>
                              <span className="text-xs text-gray-500">({tier?.days} days)</span>
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              Ref: {tier?.referencePrice.toFixed(2)} USDT
                            </div>
                          </tr>
                          <td className="py-3 px-4">
                            {expired ? (
                              <Badge variant="secondary" className="bg-red-500/20 text-red-400">
                                <XCircle className="w-3 h-3 mr-1" /> Expired
                              </Badge>
                            ) : u.is_active ? (
                              <Badge className="bg-green-500/20 text-green-400">
                                <CheckCircle className="w-3 h-3 mr-1" /> Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-gray-500/20 text-gray-400">
                                <Clock className="w-3 h-3 mr-1" /> Inactive
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-400">
                            {u.subscription_end 
                              ? new Date(u.subscription_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : '∞'
                            }
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-xs text-gray-400 max-w-[200px] truncate" title={u.trial_reason || ''}>
                              {u.trial_reason || '—'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex justify-end gap-2">
                              {!expired && u.is_active && (
                                <Select onValueChange={(days) => extendTrial(u.id, parseInt(days))}>
                                  <SelectTrigger className="w-24 bg-[#1e293b] border-gray-700 text-xs">
                                    <SelectValue placeholder="Extend" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-[#1e293b] border-gray-700">
                                    <SelectItem value="7">+7 days</SelectItem>
                                    <SelectItem value="30">+30 days</SelectItem>
                                    <SelectItem value="90">+90 days</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                              
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => revokeTrial(u.id)}
                                className="border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs"
                              >
                                Revoke
                              </Button>
                              
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => navigate(`/admin/user/${u.id}`)}
                                className="text-gray-400 hover:text-white text-xs"
                              >
                                <ExternalLink className="w-3 h-3" />
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

        {/* Tier Distribution */}
        {trialStats.totalTrials > 0 && (
          <Card className="bg-[#0b1120] border-gray-800 mb-6">
            <CardHeader>
              <CardTitle className="text-yellow-400 text-sm">Trial Distribution by Tier</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(PRICING).map(([key, value]) => (
                  <div key={key} className="p-3 bg-[#1e293b] rounded-lg">
                    <div className="text-sm font-medium text-white">{value.label}</div>
                    <div className="text-2xl font-bold text-yellow-400">
                      {trialStats.byTier[key] || 0}
                    </div>
                    <div className="text-xs text-gray-500">
                      {value.days} days • Ref: {value.referencePrice.toFixed(2)} USDT
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sync Controls */}
        <div className="bg-[#0b1120] p-4 rounded-xl mb-6 border border-gray-800">
          <h3 className="font-bold mb-4 text-yellow-400 flex items-center gap-2">
            <Database className="w-4 h-4" /> Data Sync Controls
          </h3>
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
              Sync ALL Sports
            </button>
          </div>
        </div>

        <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-lg text-sm text-blue-400">
          <strong>💡 How This Works:</strong><br />
          • This panel grants <strong>FREE trial access</strong> to influencers & VIPs<br />
          • Reference pricing (1 month = {REFERENCE_MONTHLY_RATE.toFixed(2)} USDT) is for context only<br />
          • New users receive a temporary password<br />
          • Extend or revoke trials anytime from the table above
        </div>
      </div>
    </DashboardLayout>
  );
}
