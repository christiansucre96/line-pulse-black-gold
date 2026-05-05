// src/pages/Admin.tsx
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { toast } from "sonner";
import {
  Shield, Database, RefreshCw, Loader2, Users, Gift,
  Clock, Key, CheckCircle, XCircle, ExternalLink, Copy,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader,
  CardTitle, CardDescription,
} from "@/components/ui/card";

const EDGE_URL = "https://retfkpfvhuseyphvwzxg.supabase.co/functions/v1/clever-action";

const SPORTS = [
  { key: "nba",    icon: "🏀", label: "NBA" },
  { key: "nfl",    icon: "🏈", label: "NFL" },
  { key: "mlb",    icon: "⚾", label: "MLB" },
  { key: "nhl",    icon: "🏒", label: "NHL" },
  { key: "soccer", icon: "⚽", label: "Soccer" },
];

const SPORT_OPS = [
  { key: "teams",            label: "Teams",           icon: "🏟️", desc: "All team rosters" },
  { key: "schedule",         label: "Schedule",        icon: "📅", desc: "Next 3-day games" },
  { key: "players",          label: "Players",         icon: "👤", desc: "Active rosters" },
  { key: "historical_stats", label: "Historical Stats", icon: "📊", desc: "Last 20 game logs" },
  { key: "boxscores",        label: "Box Scores",      icon: "🔢", desc: "Today's finished" },
];

const PRICING: Record<string, { label: string; days: number; referencePrice: number }> = {
  "7day":   { label: "7 Days",   days: 7,   referencePrice: 35.00 },
  "1month": { label: "1 Month",  days: 30,  referencePrice: 150.00 },
  "3month": { label: "3 Months", days: 90,  referencePrice: 400.00 },
  "1year":  { label: "1 Year",   days: 365, referencePrice: 1500.00 },
};

interface UserProfile {
  id: string; email: string; created_at: string; last_login: string | null;
  subscription_tier: string; subscription_start: string | null; subscription_end: string | null;
  is_active: boolean; is_free_trial: boolean; trial_reason: string | null; revenue_generated: number;
}

type JobStatus = "idle" | "running" | "success" | "error";
interface JobState { status: JobStatus; message?: string }

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [dbStats, setDbStats]           = useState({ totalUsers: 0, totalProps: 0 });
  const [users, setUsers]               = useState<UserProfile[]>([]);
  const [trialStats, setTrialStats]     = useState({ totalTrials: 0, activeTrials: 0, expiredTrials: 0, byTier: {} as Record<string, number> });
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [showAddTrial, setShowAddTrial]   = useState(false);
  const [newEmail, setNewEmail]           = useState("");
  const [newTier, setNewTier]             = useState("7day");
  const [tempPw, setTempPw]               = useState("");
  const [trialReason, setTrialReason]     = useState("");
  const [isExisting, setIsExisting]       = useState(false);

  const [jobs, setJobs]       = useState<Record<string, JobState>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [bfSport,   setBfSport]   = useState("mlb");
  const [bfStart,   setBfStart]   = useState("");
  const [bfEnd,     setBfEnd]     = useState("");
  const [bfDays,    setBfDays]    = useState(7);
  const [bfRunning, setBfRunning] = useState(false);
  const [bfResult,  setBfResult]  = useState<string | null>(null);

  const setJob = (sport: string, op: string, status: JobStatus, msg?: string) =>
    setJobs(p => ({ ...p, [`${sport}-${op}`]: { status, message: msg } }));
  const getJob = (sport: string, op: string): JobState =>
    jobs[`${sport}-${op}`] || { status: "idle" };

  const anyRunning = Object.values(jobs).some(j => j.status === "running") || bfRunning;

  const callEdge = async (body: any, ms = 90000) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(EDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "Sync failed");
      return d;
    } catch (e: any) {
      clearTimeout(timer);
      if (e.name === "AbortError") throw new Error("Timed out — try a smaller range");
      throw e;
    }
  };

  const runOp = async (sport: string, op: string) => {
    setJob(sport, op, "running");
    try {
      if (op === "historical_stats") {
        let offset = 0;
        let totalStats = 0;
        let batch = 0;
        while (true) {
          const d = await callEdge({ operation: "historical_stats", sport, offset, batch_size: 50 }, 90000);
          totalStats += d.total || 0;
          batch++;
          setJob(sport, op, "running", `Batch ${batch}: ${totalStats} stats so far…`);
          if (!d.hasMore) break;
          offset = d.nextOffset;
          await new Promise(r => setTimeout(r, 500));
        }
        setJob(sport, op, "success", `${totalStats} stats synced`);
        toast.success(`${sport.toUpperCase()} historical stats — ${totalStats} rows`);
        refreshDbStats();
      } else {
        const d = await callEdge({ operation: op, sport });
        const n = d.count ?? d.archived ?? d.stats_upserted ?? "✓";
        setJob(sport, op, "success", `${n}`);
        toast.success(`${sport.toUpperCase()} ${op} — ${n}`);
        if (op === "boxscores") refreshDbStats();
      }
    } catch (e: any) {
      setJob(sport, op, "error", e.message);
      toast.error(`${sport.toUpperCase()} ${op}: ${e.message}`);
    }
  };

  const syncSport = async (sport: string) => {
    for (const op of ["teams", "schedule", "players"]) {
      setJob(sport, op, "running");
      try {
        const d = await callEdge({ operation: op, sport }, 90000);
        setJob(sport, op, "success", `${d.count ?? "✓"}`);
      } catch (e: any) {
        setJob(sport, op, "error", e.message);
        toast.error(`${sport.toUpperCase()} ${op} failed: ${e.message}`);
        return;
      }
    }
    setJob(sport, "historical_stats", "running", "Starting…");
    try {
      let offset = 0, totalStats = 0, batch = 0;
      while (true) {
        const d = await callEdge({ operation: "historical_stats", sport, offset, batch_size: 50 }, 90000);
        totalStats += d.total || 0;
        batch++;
        setJob(sport, "historical_stats", "running", `Batch ${batch}: ${totalStats} stats…`);
        if (!d.hasMore) break;
        offset = d.nextOffset;
        await new Promise(r => setTimeout(r, 500));
      }
      setJob(sport, "historical_stats", "success", `${totalStats} stats`);
    } catch (e: any) {
      setJob(sport, "historical_stats", "error", e.message);
      toast.error(`${sport.toUpperCase()} historical_stats failed: ${e.message}`);
      return;
    }
    toast.success(`✅ ${sport.toUpperCase()} fully synced`);
    refreshDbStats();
  };

  const runBackfill = async () => {
    setBfRunning(true); setBfResult(null);
    try {
      const body: any = { operation: "sync_stats_range", sport: bfSport };
      if (bfStart) { body.start_date = bfStart; body.end_date = bfEnd || new Date().toISOString().split("T")[0]; }
      else body.days = bfDays;
      const d = await callEdge(body, 180000);
      const msg = `✓ ${d.games_processed} games · ${d.stats_upserted} stats · ${d.dates_processed} days`;
      setBfResult(msg);
      toast.success(`${bfSport.toUpperCase()} backfill: ${msg}`);
    } catch (e: any) {
      setBfResult(`❌ ${e.message}`);
      toast.error(e.message);
    } finally { setBfRunning(false); }
  };

  const refreshDbStats = async () => {
    try {
      const [{ count: props }, { count: users }] = await Promise.all([
        supabase.from("player_props_cache").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
      ]);
      setDbStats({ totalUsers: users || 0, totalProps: props || 0 });
    } catch {}
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,created_at,last_login,subscription_tier,subscription_start,subscription_end,is_active,is_free_trial,trial_reason,revenue_generated")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const mapped: UserProfile[] = (data || []).map(p => ({
        ...p, email: p.email || "unknown",
        subscription_tier: p.subscription_tier || "",
        is_active: p.is_active ?? false,
        is_free_trial: p.is_free_trial ?? false,
        revenue_generated: p.revenue_generated ?? 0,
      }));
      setUsers(mapped);

      const trials = mapped.filter(u => u.is_free_trial);
      const now = new Date();
      setTrialStats({
        totalTrials: trials.length,
        activeTrials: trials.filter(u => u.is_active && (!u.subscription_end || new Date(u.subscription_end) > now)).length,
        expiredTrials: trials.filter(u => u.subscription_end && new Date(u.subscription_end) <= now).length,
        byTier: trials.reduce((a, u) => ({ ...a, [u.subscription_tier]: (a[u.subscription_tier] || 0) + 1 }), {} as Record<string, number>),
      });
    } catch { toast.error("Failed to load users"); }
    finally { setLoadingUsers(false); }
  };

  const makePw = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  };

  const grantTrial = async () => {
    if (!newEmail) { toast.error("Email required"); return; }
    const tier = PRICING[newTier];
    try {
      let uid: string;
      if (isExisting) {
        const { data } = await supabase.from("profiles").select("id").eq("email", newEmail.toLowerCase()).maybeSingle();
        if (!data) throw new Error("User not found");
        uid = data.id;
      } else {
        const pw = tempPw || makePw();
        const { data: au, error } = await supabase.auth.admin.createUser({ email: newEmail.toLowerCase(), password: pw, email_confirm: true });
        if (error) throw error;
        uid = au.user!.id;
        setTempPw(pw);
      }
      const start = new Date();
      const end   = new Date(start.getTime() + tier.days * 86400000);
      await supabase.from("profiles").upsert({ id: uid, user_id: uid, email: newEmail.toLowerCase(), subscription_tier: newTier, subscription_start: start.toISOString(), subscription_end: end.toISOString(), is_active: true, is_free_trial: true, trial_reason: trialReason || `Trial - ${newTier}`, trial_granted_by: user?.id }, { onConflict: "id" });
      await supabase.from("subscriptions").delete().eq("user_id", uid);
      await supabase.from("subscriptions").insert({ user_id: uid, tier: newTier, amount: 0, currency: "USDT", status: "active", start_date: start.toISOString(), end_date: end.toISOString(), is_free_trial: true, granted_by: user?.id, trial_reason: trialReason });
      toast.success(`✅ Trial granted to ${newEmail}`);
      setShowAddTrial(false); setNewEmail(""); setTempPw(""); setTrialReason(""); setIsExisting(false);
      loadUsers();
    } catch (e: any) { toast.error(e.message); }
  };

  const extendTrial = async (uid: string, days: number) => {
    const end = new Date(Date.now() + days * 86400000);
    await supabase.from("profiles").update({ subscription_end: end.toISOString() }).eq("id", uid);
    await supabase.from("subscriptions").update({ end_date: end.toISOString() }).eq("user_id", uid).eq("status", "active");
    toast.success("Extended"); loadUsers();
  };

  const revokeTrial = async (uid: string) => {
    if (!confirm("Revoke this trial?")) return;
    await supabase.from("profiles").update({ is_active: false, subscription_end: new Date().toISOString() }).eq("id", uid);
    await supabase.from("subscriptions").update({ status: "revoked" }).eq("user_id", uid);
    toast.success("Revoked"); loadUsers();
  };

  const expired = (d: string | null) => d ? new Date(d) < new Date() : false;

  useEffect(() => { if (isAdmin) { refreshDbStats(); loadUsers(); } }, [isAdmin]);

  if (authLoading) return <div className="p-10 text-center text-yellow-400">Loading…</div>;
  const forceAdmin = user?.email === "christiansucre1@gmail.com";
  if (!isAdmin && !forceAdmin) return <Navigate to="/scanner" replace />;

  const Dot = ({ s }: { s: JobStatus }) => (
    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${s === "running" ? "bg-yellow-400 animate-pulse" : s === "success" ? "bg-green-500" : s === "error" ? "bg-red-500" : "bg-gray-600"}`} />
  );

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-yellow-400">
            <Shield className="w-6 h-6" /> Admin Panel
          </h1>
          <Badge variant="outline" className="border-green-500/50 text-green-400">
            <Gift className="w-3 h-3 mr-1" /> Trial Manager
          </Badge>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Users",    value: dbStats.totalUsers,       color: "text-white",       Icon: Users },
            { label: "Active Trials",  value: trialStats.activeTrials,  color: "text-green-400",   Icon: Gift },
            { label: "Expired Trials", value: trialStats.expiredTrials, color: "text-red-400",     Icon: Clock },
            { label: "Cached Props",   value: dbStats.totalProps,       color: "text-yellow-400",  Icon: Database },
          ].map(({ label, value, color, Icon }) => (
            <Card key={label} className="bg-[#0b1120] border-gray-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                  <Icon className="w-4 h-4" /> {label}
                </CardTitle>
              </CardHeader>
              <CardContent><div className={`text-2xl font-bold ${color}`}>{value}</div></CardContent>
            </Card>
          ))}
        </div>

        {/* Data Sync */}
        <div className="bg-[#0b1120] rounded-xl border border-gray-800 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <h3 className="font-bold text-yellow-400 flex items-center gap-2">
              <Database className="w-4 h-4" /> Data Sync Controls
              <span className="text-xs font-normal text-gray-600 ml-1">— 20 games per player</span>
            </h3>
            <button
              onClick={async () => {
                for (const { key } of SPORTS) {
                  await syncSport(key);
                  await new Promise(r => setTimeout(r, 500));
                }
                toast.success("🚀 All sports synced!");
              }}
              disabled={anyRunning}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black rounded font-bold text-sm disabled:opacity-40 flex items-center gap-2 transition"
            >
              {anyRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync All
            </button>
          </div>

          <div className="divide-y divide-gray-800/40">
            {SPORTS.map(({ key: sport, icon, label }) => {
              const isOpen   = expanded[sport];
              const opStates = SPORT_OPS.map(o => getJob(sport, o.key).status);
              const running  = opStates.includes("running");
              const allOk    = opStates.every(s => s === "success");
              const hasErr   = opStates.includes("error");

              return (
                <div key={sport}>
                  <div className="flex items-center gap-3 px-5 py-3">
                    <span className="text-lg">{icon}</span>
                    <span className="font-semibold text-white w-16">{label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${running ? "bg-yellow-500/20 text-yellow-400" : allOk ? "bg-green-500/20 text-green-400" : hasErr ? "bg-red-500/20 text-red-400" : "bg-gray-800 text-gray-500"}`}>
                      {running ? "Syncing…" : allOk ? "✓ Done" : hasErr ? "Error" : "Idle"}
                    </span>
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() => syncSport(sport)}
                        disabled={anyRunning}
                        className="px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 text-yellow-400 rounded text-xs font-semibold disabled:opacity-40 flex items-center gap-1 transition"
                      >
                        {running && <Loader2 className="w-3 h-3 animate-spin" />}
                        Full Sync
                      </button>
                      <button
                        onClick={() => setExpanded(e => ({ ...e, [sport]: !e[sport] }))}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded text-xs flex items-center gap-1 transition"
                      >
                        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {isOpen ? "Hide" : "Steps"}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="bg-[#060d1a] px-5 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                      {SPORT_OPS.map(op => {
                        const job = getJob(sport, op.key);
                        return (
                          <div key={op.key} className={`rounded-lg p-3 border flex flex-col gap-1.5 ${
                            job.status === "running" ? "border-yellow-500/40 bg-yellow-500/5" :
                            job.status === "success" ? "border-green-500/30 bg-green-500/5" :
                            job.status === "error"   ? "border-red-500/30 bg-red-500/5" :
                            "border-gray-800 bg-[#0b1120]"
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-300">{op.icon} {op.label}</span>
                              <Dot s={job.status} />
                            </div>
                            <p className="text-[10px] text-gray-600">{op.desc}</p>
                            {job.message && (
                              <p className={`text-[10px] font-medium ${job.status === "error" ? "text-red-400" : "text-green-400"}`}>
                                {job.status === "error" ? "✗ " : "✓ "}{job.message}
                              </p>
                            )}
                            <button
                              onClick={() => runOp(sport, op.key)}
                              disabled={anyRunning}
                              className="mt-auto w-full py-1 rounded text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-40 flex items-center justify-center gap-1 transition"
                            >
                              {job.status === "running" && <Loader2 className="w-3 h-3 animate-spin" />}
                              {job.status === "running" ? "Running…" : "Run"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Backfill */}
        <div className="bg-[#0b1120] rounded-xl border border-gray-800 p-5">
          <h3 className="font-bold text-yellow-400 mb-4">📦 Backfill Box Scores by Date Range</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Sport</label>
              <select value={bfSport} onChange={e => setBfSport(e.target.value)} className="bg-[#1e293b] border border-gray-700 rounded px-3 py-1.5 text-sm text-white">
                {SPORTS.map(s => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Start Date</label>
              <input type="date" value={bfStart} onChange={e => setBfStart(e.target.value)} className="bg-[#1e293b] border border-gray-700 rounded px-3 py-1.5 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">End Date</label>
              <input type="date" value={bfEnd} onChange={e => setBfEnd(e.target.value)} className="bg-[#1e293b] border border-gray-700 rounded px-3 py-1.5 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Or Last N Days</label>
              <input type="number" min={1} max={60} value={bfDays} onChange={e => setBfDays(+e.target.value)} className="bg-[#1e293b] border border-gray-700 rounded px-3 py-1.5 text-sm text-white w-20" />
            </div>
            <button onClick={runBackfill} disabled={bfRunning || anyRunning} className="px-4 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-black rounded font-bold text-sm disabled:opacity-40 flex items-center gap-2 transition">
              {bfRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : "⚡"}
              {bfRunning ? "Running…" : "Run Backfill"}
            </button>
          </div>
          {bfResult && <p className={`mt-3 text-sm font-medium ${bfResult.startsWith("❌") ? "text-red-400" : "text-green-400"}`}>{bfResult}</p>}
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-gray-600">
            <span>⭐ MLB start: <strong className="text-gray-500">2026-03-27</strong></span>
            <span>⭐ NHL start: <strong className="text-gray-500">2025-10-04</strong></span>
            <span>⭐ NFL start: <strong className="text-gray-500">2025-09-05</strong></span>
            <span>⭐ Soccer: use last 30 days</span>
          </div>
        </div>

        {/* Trial Dialog */}
        <Dialog open={showAddTrial} onOpenChange={setShowAddTrial}>
          <DialogContent className="bg-[#0b1120] border-gray-800 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-yellow-400 flex items-center gap-2"><Gift className="w-5 h-5" /> Grant Free Trial</DialogTitle>
              <DialogDescription className="text-gray-400">Reference: 1 month = 150.00 USDT</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex gap-4 p-3 bg-[#1e293b] rounded-lg">
                {[false, true].map(v => (
                  <label key={String(v)} className="flex items-center gap-2 cursor-pointer flex-1">
                    <input type="radio" name="ut" checked={isExisting === v} onChange={() => setIsExisting(v)} />
                    <span className="text-sm">{v ? "👤 Existing" : "✨ New User"}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Email</Label>
                <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@example.com" className="bg-[#1e293b] border-gray-700 text-white" />
              </div>
              {!isExisting && (
                <div className="space-y-2">
                  <Label className="text-gray-300">Temp Password</Label>
                  <div className="flex gap-2">
                    <Input value={tempPw} readOnly onChange={e => setTempPw(e.target.value)} placeholder="Auto-generated" className="bg-[#1e293b] border-gray-700 text-white font-mono flex-1" />
                    <Button type="button" variant="outline" onClick={() => setTempPw(makePw())} className="border-gray-700 text-gray-300 shrink-0"><Key className="w-4 h-4" /></Button>
                    {tempPw && <Button type="button" variant="outline" onClick={async () => { await navigator.clipboard.writeText(tempPw); toast.success("Copied"); }} className="border-gray-700 text-blue-400 shrink-0"><Copy className="w-4 h-4" /></Button>}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-gray-300">Duration</Label>
                <Select value={newTier} onValueChange={setNewTier}>
                  <SelectTrigger className="bg-[#1e293b] border-gray-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1e293b] border-gray-700">
                    {Object.entries(PRICING).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label} — {v.referencePrice.toFixed(2)} USDT ref</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Reason (optional)</Label>
                <Textarea value={trialReason} onChange={e => setTrialReason(e.target.value)} placeholder="e.g., YouTube influencer..." className="bg-[#1e293b] border-gray-700 text-white min-h-[80px]" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddTrial(false)} className="border-gray-700 text-gray-300">Cancel</Button>
              <Button onClick={grantTrial} disabled={!newEmail} className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"><Gift className="w-4 h-4 mr-2" /> Grant Trial</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Trial Table */}
        <Card className="bg-[#0b1120] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-yellow-400 flex items-center gap-2"><Users className="w-5 h-5" /> Trial Users</CardTitle>
              <CardDescription className="text-gray-400">Manage free trial access</CardDescription>
            </div>
            <Button onClick={() => setShowAddTrial(true)} className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"><Gift className="w-4 h-4 mr-2" /> Grant New Trial</Button>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <div className="text-center py-8 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading…</div>
            ) : users.filter(u => u.is_free_trial).length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Gift className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>No trial users yet</p>
                <Button variant="outline" onClick={() => setShowAddTrial(true)} className="mt-3 border-yellow-500/50 text-yellow-400">Grant First Trial</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {["User", "Tier", "Status", "Ends", "Reason", "Actions"].map(h => (
                        <th key={h} className={`py-3 px-4 text-sm font-semibold text-gray-400 ${h === "Actions" ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.filter(u => u.is_free_trial).map(u => {
                      const exp = expired(u.subscription_end);
                      const tier = PRICING[u.subscription_tier];
                      return (
                        <tr key={u.id} className="border-b border-gray-800/50 hover:bg-[#1e293b]/50">
                          <td className="py-3 px-4">
                            <div className="text-sm font-medium text-white">{u.email}</div>
                            <div className="text-xs text-gray-500">{u.last_login ? `Last: ${new Date(u.last_login).toLocaleDateString()}` : "Never logged in"}</div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">{tier?.label || u.subscription_tier}</Badge>
                            <div className="text-xs text-gray-600 mt-1">Ref: {tier?.referencePrice?.toFixed(2)} USDT</div>
                          </td>
                          <td className="py-3 px-4">
                            {exp ? <Badge className="bg-red-500/20 text-red-400"><XCircle className="w-3 h-3 mr-1" />Expired</Badge>
                              : u.is_active ? <Badge className="bg-green-500/20 text-green-400"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>
                              : <Badge className="bg-gray-500/20 text-gray-400"><Clock className="w-3 h-3 mr-1" />Inactive</Badge>}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-400">
                            {u.subscription_end ? new Date(u.subscription_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "∞"}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs text-gray-400 max-w-[180px] truncate block">{u.trial_reason || "—"}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex justify-end gap-2">
                              {!exp && u.is_active && (
                                <Select onValueChange={d => extendTrial(u.id, +d)}>
                                  <SelectTrigger className="w-24 bg-[#1e293b] border-gray-700 text-xs"><SelectValue placeholder="Extend" /></SelectTrigger>
                                  <SelectContent className="bg-[#1e293b] border-gray-700">
                                    <SelectItem value="7">+7 days</SelectItem>
                                    <SelectItem value="30">+30 days</SelectItem>
                                    <SelectItem value="90">+90 days</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                              <Button size="sm" variant="outline" onClick={() => revokeTrial(u.id)} className="border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs">Revoke</Button>
                              <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/user/${u.id}`)} className="text-gray-400 hover:text-white"><ExternalLink className="w-3 h-3" /></Button>
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

        {/* Info */}
        <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-lg text-sm text-blue-400">
          <strong>💡 Sync Order:</strong> For each sport — <strong>Teams → Schedule → Players → Historical Stats</strong>.
          Historical Stats pulls exactly <strong>20 games</strong> per player and fixes any orphaned stats.
          Use <strong>Backfill</strong> to pull older box scores directly from ESPN box scores by date range.
        </div>

      </div>
    </DashboardLayout>
  );
}
