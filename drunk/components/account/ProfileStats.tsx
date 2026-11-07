import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ExternalLink, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import ProfilePanel from "./ProfilePanel";
import { PlayerStatsBoard, PlayerStatsSkeleton, usePlayerStats } from "../PlayerStats";
import { playerPath } from "../boardPieces";
import { useDrunkAccount } from "../../lib/drunkAccount";

/**
 * The signed-in profile page: an "Edit profile" bar (the account form folded
 * away inside it) at the top, then the player's full stats board.
 */
const ProfileStats = ({ onSignedOut, children }: { onSignedOut?: () => void; children?: ReactNode }) => {
  const { profile } = useDrunkAccount();
  const { data, status } = usePlayerStats({ userId: profile?.id });
  const [editing, setEditing] = useState(false);

  if (!profile) return null;

  const editor = (
    <div className="w-full overflow-hidden rounded-[6px] border-2 border-foreground/70 bg-background motion-safe:animate-rise">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          aria-expanded={editing}
          className="flex flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground"
        >
          <Pencil className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 font-board text-[13px] font-semibold uppercase tracking-[0.22em]">Edit profile</span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", editing && "rotate-180")} />
        </button>
        {data && data.games > 0 && (
          <Link
            to={playerPath(data.name)}
            className="flex items-center gap-2 border-l border-foreground/25 px-4 text-[11px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
            title="See what everyone else sees"
          >
            Public page
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      {editing && (
        <div className="border-t border-foreground/25 px-4 pb-5 pt-5">
          <ProfilePanel onSignedOut={onSignedOut} showRecord={false} />
        </div>
      )}
    </div>
  );

  return (
    <div className="mt-8 w-full max-w-md">
      {children}
      {data ? (
        <>
          {editor}
          <PlayerStatsBoard s={data} isYou className="mt-6" />
        </>
      ) : (
        <div className="flex flex-col gap-6">
          {status === "loading" ? <PlayerStatsSkeleton /> : null}
          {/* No stats (or offline): still let them edit their account. */}
          {status !== "loading" && (
            <div className="w-full overflow-hidden rounded-[6px] border-2 border-foreground/70 bg-background px-4 pb-5 pt-5">
              <ProfilePanel onSignedOut={onSignedOut} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfileStats;
