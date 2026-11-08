import { useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import AccountShell from "../components/account/AccountShell";
import { ProfileEditBar } from "../components/account/ProfileStats";
import { PlayerStatsBoard, PlayerStatsSkeleton, usePlayerStats } from "../components/PlayerStats";
import { ART } from "../components/boardPieces";
import { useDrunkAccount } from "../lib/drunkAccount";

const PILL =
  "inline-flex min-h-10 items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.03] px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

/** /drunk/drunkopoly/player/?name=… (or legacy /player/:name) — anyone's all-time stats, opened from the Hall of Fame. */
const PlayerProfile = () => {
  const params = useParams();
  const [search] = useSearchParams();
  // Query form is canonical: it maps to a static page with Drunkopoly share meta.
  const name = search.get("name") ?? (params.name ? decodeURIComponent(params.name) : "");
  const navigate = useNavigate();
  const { profile } = useDrunkAccount();
  const { data, status } = usePlayerStats({ name });

  useEffect(() => window.scrollTo(0, 0), [name]);

  const isYou = !!(profile && data?.account && data.account.id === profile.id);
  const openProfile = () => navigate("/drunk/drunkopoly", { state: { screen: "profile" } });

  return (
    <AccountShell
      onOpenProfile={openProfile}
      onSignIn={() => navigate("/drunk/drunkopoly")}
      onSignedOut={() => navigate("/drunk/drunkopoly")}
    >
      <div className="flex w-full max-w-md flex-1 flex-col">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/drunk/drunkopoly"))}
          className={`${PILL} self-start motion-safe:animate-rise`}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        {isYou && <ProfileEditBar onSignedOut={() => navigate("/drunk/drunkopoly")} className="mt-6" />}

        <div className={`${isYou ? "mt-6" : "mt-8"} w-full`}>
          {status === "loading" && !data && <PlayerStatsSkeleton />}

          {(status === "missing" || (status === "error" && !data)) && (
            <div className="rounded-[6px] border-2 border-dashed border-foreground/30 px-6 py-10 text-center motion-safe:animate-rise">
              <img src={ART.police} alt="" aria-hidden className="mx-auto h-20 w-20 object-contain" />
              <p className="mt-4 font-board text-lg font-semibold uppercase tracking-[0.16em]">
                {status === "missing" ? "No player by that name" : "Couldn't load stats"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {status === "missing" ? "They haven't played a real game yet." : "Check your connection and try again."}
              </p>
              <Link to="/drunk/drunkopoly" className={`${PILL} mt-6`}>Back to the lobby</Link>
            </div>
          )}

          {data && (
            <PlayerStatsBoard
              s={data}
              isYou={isYou}
            />
          )}
        </div>
      </div>
    </AccountShell>
  );
};

export default PlayerProfile;
