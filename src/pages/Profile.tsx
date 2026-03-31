import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { toast } from "sonner";
import { User, Save, Trash2 } from "lucide-react";

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

interface SavedParlay {
  id: string;
  name: string | null;
  legs: any;
  total_odds: number | null;
  stake: number | null;
  potential_payout: number | null;
  result: string | null;
  created_at: string;
}

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>({ display_name: "", avatar_url: "", bio: "" });
  const [parlays, setParlays] = useState<SavedParlay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "history">("profile");

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [profileRes, parlayRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("saved_parlays").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      if (profileRes.data) setProfile(profileRes.data);
      if (parlayRes.data) setParlays(parlayRes.data);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: profile.display_name, bio: profile.bio })
      .eq("user_id", user.id);
    if (error) toast.error("Failed to save");
    else toast.success("Profile updated!");
    setSaving(false);
  };

  const handleDeleteParlay = async (id: string) => {
    const { error } = await supabase.from("saved_parlays").delete().eq("id", id);
    if (!error) {
      setParlays((p) => p.filter((x) => x.id !== id));
      toast.success("Parlay deleted");
    }
  };

  const resultColor = (r: string | null) =>
    r === "won" ? "text-green-400 bg-green-400/10" : r === "lost" ? "text-red-400 bg-red-400/10" : "text-primary bg-primary/10";

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-display font-bold text-foreground mb-6 flex items-center gap-2">
          <User className="w-6 h-6 text-primary" /> My Account
        </h1>

        <div className="flex gap-2 mb-6 border-b border-border">
          {(["profile", "history"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-semibold text-sm capitalize transition-colors ${
                activeTab === tab ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "profile" ? "Profile Settings" : "Parlay History"}
            </button>
          ))}
        </div>

        {activeTab === "profile" ? (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email</label>
              <input value={user?.email || ""} disabled className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-muted-foreground cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Display Name</label>
              <input
                value={profile.display_name || ""}
                onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Bio</label>
              <textarea
                value={profile.bio || ""}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-gold text-primary-foreground font-display font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {parlays.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-xl">
                No saved parlays yet. Build one in the Parlay Builder!
              </div>
            ) : (
              parlays.map((p) => (
                <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-foreground">{p.name || "Untitled Parlay"}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {Array.isArray(p.legs) ? `${(p.legs as any[]).length} legs` : "0 legs"} • Odds: {p.total_odds?.toFixed(2) || "-"} • Stake: ${p.stake || 0}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{new Date(p.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${resultColor(p.result)}`}>
                      {p.result || "pending"}
                    </span>
                    <button onClick={() => handleDeleteParlay(p.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
