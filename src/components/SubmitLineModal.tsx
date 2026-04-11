// src/components/SubmitLineModal.tsx
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

interface SubmitLineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player?: { id: string; name: string; team: string };
  sport?: string;
}

export function SubmitLineModal({ open, onOpenChange, player, sport = "nba" }: SubmitLineModalProps) {
  const [bookmaker, setBookmaker] = useState("Stake");
  const [propType, setPropType] = useState("points");
  const [line, setLine] = useState("");
  const [odds, setOdds] = useState("-110");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);

    try {
      const authResult = await supabase.auth.getUser();
      const user = authResult.data?.user;
      
      const { error } = await supabase.from("user_submitted_lines").insert({
        user_id: user?.id || null,
        sport,
        player_id: player?.id || null,
        player_name: player?.name || "",
        team: player?.team || "",
        bookmaker,
        prop_type: propType,
        line_value: line ? parseFloat(line) : 0,
        odds_american: odds ? parseInt(odds.replace("+", "")) : -110,
        status: "pending",
        submitted_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      });

      if (error) throw error;

      setStatus({ type: "success", message: "✅ Line submitted! Earn reputation when verified." });
      setLine("");
      setOdds("-110");
      setTimeout(() => { onOpenChange(false); setStatus(null); }, 1500);
      
    } catch (err: any) {
      setStatus({ type: "error", message: err.message || "Failed to submit" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] bg-[#0f172a] border-gray-700 text-yellow-400">
        <DialogHeader>
          <DialogTitle className="text-yellow-400 flex items-center gap-2">
            📊 Report Player Prop Line
          </DialogTitle>
          <p className="text-sm text-gray-400">
            Enter the line you see. We'll verify via consensus & calculate your edge.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {player && (
            <div className="bg-[#020617] p-3 rounded-lg border border-gray-800">
              <p className="font-semibold text-yellow-400">{player.name}</p>
              <p className="text-xs text-gray-400">{player.team} • {sport?.toUpperCase()}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Bookmaker</Label>
              <Select value={bookmaker} onValueChange={setBookmaker}>
                <SelectTrigger className="bg-[#020617] border-gray-700 text-yellow-400">
                  <SelectValue placeholder="Select book" />
                </SelectTrigger>
                <SelectContent className="bg-[#0f172a] border-gray-700">
                  <SelectItem value="Stake" className="text-yellow-400">Stake</SelectItem>
                  <SelectItem value="BetOnline" className="text-yellow-400">BetOnline</SelectItem>
                  <SelectItem value="DraftKings" className="text-yellow-400">DraftKings</SelectItem>
                  <SelectItem value="FanDuel" className="text-yellow-400">FanDuel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Prop Type</Label>
              <Select value={propType} onValueChange={setPropType}>
                <SelectTrigger className="bg-[#020617] border-gray-700 text-yellow-400">
                  <SelectValue placeholder="Select prop" />
                </SelectTrigger>
                <SelectContent className="bg-[#0f172a] border-gray-700">
                  <SelectItem value="points" className="text-yellow-400">Points</SelectItem>
                  <SelectItem value="rebounds" className="text-yellow-400">Rebounds</SelectItem>
                  <SelectItem value="assists" className="text-yellow-400">Assists</SelectItem>
                  <SelectItem value="PRA" className="text-yellow-400">Pts+Reb+Ast</SelectItem>
                  <SelectItem value="doubleDouble" className="text-yellow-400">Double-Double</SelectItem>
                  <SelectItem value="anytimeTD" className="text-yellow-400">Anytime TD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Line Value *</Label>
              <Input
                type="number"
                step="0.5"
                value={line}
                onChange={(e) => setLine(e.target.value)}
                placeholder="24.5"
                required
                className="bg-[#020617] border-gray-700 text-yellow-400 placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Odds</Label>
              <Input
                value={odds}
                onChange={(e) => setOdds(e.target.value)}
                placeholder="-110"
                className="bg-[#020617] border-gray-700 text-yellow-400 placeholder:text-gray-500"
              />
            </div>
          </div>

          {status && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              status.type === "success" ? "bg-green-900/30 text-green-400 border border-green-800" : "bg-red-900/30 text-red-400 border border-red-800"
            }`}>
              {status.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {status.message}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting} className="border-gray-700 text-gray-300 hover:bg-[#1e293b]">
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !line} className="bg-yellow-500 text-black hover:bg-yellow-600 disabled:opacity-50">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Line 🎯"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
