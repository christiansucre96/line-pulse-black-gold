// src/components/SubmitOddsModal.tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SubmitOddsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubmitOddsModal({ open, onOpenChange }: SubmitOddsModalProps) {
  // 👇 Simple state for form fields
  const [player, setPlayer] = useState('');
  const [propType, setPropType] = useState('points');
  const [bookmaker, setBookmaker] = useState('stake');
  const [line, setLine] = useState('');
  const [odds, setOdds] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 👇 Just logging for now. File 2 will handle saving to Supabase.
    console.log('📤 Form submitted:', { player, propType, bookmaker, line, odds });
    
    // Close modal & clear form
    onOpenChange(false);
    setPlayer('');
    setLine('');
    setOdds('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>📊 Report Player Prop Line</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Enter the Stake/BetOnline line you see. We'll track it for edge analysis.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Player Name */}
          <div className="space-y-2">
            <Label htmlFor="player">Player Name *</Label>
            <Input
              id="player"
              value={player}
              onChange={(e) => setPlayer(e.target.value)}
              placeholder="e.g., LeBron James"
              required
            />
          </div>

          {/* Prop Type & Bookmaker (side-by-side) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prop Type</Label>
              <Select value={propType} onValueChange={setPropType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="points">Points</SelectItem>
                  <SelectItem value="rebounds">Rebounds</SelectItem>
                  <SelectItem value="assists">Assists</SelectItem>
                  <SelectItem value="threes">3-Pointers</SelectItem>
                  <SelectItem value="ptra">Pts+Reb+Ast</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Bookmaker</Label>
              <Select value={bookmaker} onValueChange={setBookmaker}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stake">Stake.com</SelectItem>
                  <SelectItem value="betonline">BetOnline.ag</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Line & Odds (side-by-side) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="line">Line Value *</Label>
              <Input
                id="line"
                type="number"
                step="0.5"
                value={line}
                onChange={(e) => setLine(e.target.value)}
                placeholder="e.g., 24.5"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="odds">Odds (American)</Label>
              <Input
                id="odds"
                type="number"
                value={odds}
                onChange={(e) => setOdds(e.target.value)}
                placeholder="e.g., -110"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit Line 🎯</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
