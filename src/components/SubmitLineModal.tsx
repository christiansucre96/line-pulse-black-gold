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
      // ✅ Safe Supabase auth call
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

      setStatus({ type: "success", message: "✅ Line submitted!" });
      setLine("");
      setTimeout(() => { onOpenChange(false); setStatus(null); }, 1000);
      
    } catch (err: any) {
      setStatus({ type: "error", message: err.message || "Failed" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] bg-[#0f172a] border-gray-700 text-yellow-400">
        <DialogHeader>
          <DialogTitle className="text-yellow-400">📊 Report Line</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bookmaker</Label>
              <Select value={bookmaker} onValueChange={setBookmaker}>
                <SelectTrigger className="bg-[#020617] border-gray-700"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#0f172a]">
                  {["Stake", "BetOnline", "DraftKings", "FanDuel"].map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prop</Label>
              <Select value={propType} onValueChange={setPropType}>
                <SelectTrigger className="bg-[#020617] border-gray-700"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#0f172a]">
                  {["points", "rebounds", "assists", "PRA"].map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Line *</Label>
              <Input type="number" step="0.5" value={line} onChange={(e) => setLine(e.target.value)} placeholder="24.5" required className="bg-[#020617] border-gray-700" />
            </div>
            <div className="space-y-2">
              <Label>Odds</Label>
              <Input value={odds} onChange={(e) => setOdds(e.target.value)} placeholder="-110" className="bg-[#020617] border-gray-700" />
            </div>
          </div>

          {status && (
            <div className={`p-3 rounded ${status.type === "success" ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>
              {status.type === "success" ? <CheckCircle2 className="inline mr-2" /> : <AlertCircle className="inline mr-2" />}
              {status.message}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting || !line} className="bg-yellow-500 text-black">
              {submitting ? <Loader2 className="animate-spin" /> : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
