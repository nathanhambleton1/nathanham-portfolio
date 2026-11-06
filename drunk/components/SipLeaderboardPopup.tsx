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
          <DialogTitle className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
              <Trophy className="w-5 h-5" />
            </span>
            Sip Leaderboard
          </DialogTitle>
          <DialogClose className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <X className="w-4 h-4" />
          </DialogClose>
        </DialogHeader>
        <div className="mt-1 max-h-[60vh] space-y-2 overflow-y-auto overscroll-contain">
          {sorted.map((p, i) => {
            const isMe = p.id === currentPlayerId;
            return (
              <div
                key={p.id}
                className={`flex min-h-[44px] items-center justify-between gap-3 rounded-xl border px-3 py-2 motion-safe:animate-rise ${isMe ? "border-brand/60 bg-brand/10 font-semibold ring-1 ring-inset ring-brand/30" : "border-foreground/10 bg-foreground/[0.03]"}`}
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`w-5 shrink-0 text-right font-display text-sm font-bold tabular-nums ${i === 0 ? "text-brand" : "text-muted-foreground"}`}>{i + 1}</span>
                  <span className="truncate text-sm">{p.name}{isMe ? " (you)" : ""}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {(p.pending_sips ?? 0) > 0 && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-500 ring-1 ring-inset ring-amber-500/20">+{p.pending_sips} pending</span>
                  )}
                  <span className="font-display text-sm font-semibold tabular-nums">{p.total_sips ?? 0} <span className="font-sans text-xs font-normal text-muted-foreground">sips</span></span>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
