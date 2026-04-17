import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "./ui/dialog";
import { Trophy, X } from "lucide-react";

type Player = { id: string; name: string; total_sips?: number; pending_sips?: number };

export default function SipLeaderboardPopup({
  open,
  onOpenChange,
  players,
  currentPlayerId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  players: Player[];
  currentPlayerId?: string;
}) {
  const sorted = [...players].sort((a, b) => (b.total_sips ?? 0) - (a.total_sips ?? 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Sip Leaderboard
          </DialogTitle>
          <DialogClose className="rounded-sm opacity-70 hover:opacity-100 focus:outline-none">
            <X className="w-4 h-4" />
          </DialogClose>
        </DialogHeader>
        <div className="space-y-2 mt-1">
          {sorted.map((p, i) => {
            const isMe = p.id === currentPlayerId;
            return (
              <div
                key={p.id}
                className={`flex items-center justify-between px-3 py-2 rounded-md ${isMe ? "bg-primary/15 font-semibold" : "bg-muted/40"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm opacity-60 w-5 text-right">{i + 1}.</span>
                  <span className="text-sm">{p.name}{isMe ? " (you)" : ""}</span>
                </div>
                <div className="flex items-center gap-2">
                  {(p.pending_sips ?? 0) > 0 && (
                    <span className="text-xs text-orange-500 font-medium">+{p.pending_sips} pending</span>
                  )}
                  <span className="text-sm font-medium">{p.total_sips ?? 0} sips</span>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
