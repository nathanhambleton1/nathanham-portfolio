import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { STREET_GROUPS, streetColor, type PropertyColor } from "./BoardArt";
import PlayerAvatar from "./PlayerAvatar";
import { drunkSupabase as supabase } from "../lib/drunkSupabase";
import {
  ART,
  CountUp,
  DeedRow,
  Frame,
  NightChart,
  RecordRow,
  Rise,
  StatSpace,
  ago,
  fmt,
  longDate,
  money,
  playerPath,
  plural,
  shortDate,
  SIPS_PER_BEER,
} from "./boardPieces";

/*
 * One player's all-time Drunkopoly record, dressed like the lobby's Hall of
 * Fame: a title deed with their name on it, board spaces for the corners,
 * rival cards and a game log. Data comes from the `drunkopoly_player_stats`
 * SQL function (supabase/drunkopoly_player_stats.sql).
 */

type Rival = { name: string; avatar_url: string | null; sips: number };

type RecentGame = {
  code: string;
  date: string;
  players: number;
  sips_taken: number;
  sips_given: number;
  result: "won" | "bankrupt" | "played";
};

export type PlayerStatsData = {
  name: string;
  aliases: string[];
  account: {
    id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    created_at: string | null;
  } | null;
  avatar_url: string | null;
  games: number;
  wins: number;
  bankruptcies: number;
  nights: number;
  hours: number;
  first_game: string | null;
  last_game: string | null;
  sips_taken: number;
  sips_given: number;
  pours: number;
  biggest_pour: number;
  passed_go: number;
  go_money: number;
  jailed: number;
  jail_fines: number;
  jail_cards: number;
  tax: number;
  free_parking_hits: number;
  free_parking_money: number;
  free_parking_best: number;
  gambles: number;
  gamble_wins: number;
  trade_timers: number;
  wettest_game: { code: string; date: string; sips: number; players: number } | null;
  longest_game: { code: string; date: string; hours: number } | null;
  nemesis: Rival | null;
  victim: Rival | null;
  weekdays: number[];
  recent: RecentGame[];
  rank: { of: number; games: number; sips: number; wins: number };
};

export type PlayerLookup = { name?: string | null; userId?: string | null };

const cacheKey = ({ name, userId }: PlayerLookup) =>
  `drunkopoly:player:${userId ? `id:${userId}` : `name:${(name ?? "").trim().toLowerCase()}`}`;

const readCache = (q: PlayerLookup): PlayerStatsData | null => {
  try {
    const raw = localStorage.getItem(cacheKey(q));
    return raw ? (JSON.parse(raw) as PlayerStatsData) : null;
  } catch {
    return null;
  }
};

/**
 * Loads a player's stats by table name or account id. `status` is "missing"
 * when nobody by that name has played a real game.
 */
export const usePlayerStats = ({ name, userId }: PlayerLookup) => {
  const [data, setData] = useState<PlayerStatsData | null>(() => readCache({ name, userId }));
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">(() =>
    readCache({ name, userId }) ? "ready" : "loading",
  );

  useEffect(() => {
    if (!name && !userId) return;
    let alive = true;
    const cached = readCache({ name, userId });
    setData(cached);
    setStatus(cached ? "ready" : "loading");
    supabase
      .rpc("drunkopoly_player_stats", { p_name: userId ? null : name, p_user_id: userId ?? null })
      .then(({ data: d, error }) => {
        if (!alive) return;
        if (error) {
          if (!cached) setStatus("error");
          return;
        }
        if (!d) {
          setData(null);
          setStatus("missing");
          return;
        }
        setData(d as PlayerStatsData);
        setStatus("ready");
        try {
          localStorage.setItem(cacheKey({ name, userId }), JSON.stringify(d));
        } catch {
          /* storage may be unavailable */
        }
      });
    return () => {
      alive = false;
    };
  }, [name, userId]);

  return { data, status };
};

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

/** Every player gets a property colour of their own, picked from their name. */
export const playerColor = (name: string): PropertyColor => {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return STREET_GROUPS[h % STREET_GROUPS.length];
};

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
const perGame = (n: number, games: number) => (games ? (n / games).toFixed(1).replace(/\.0$/, "") : "0");
const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

/** A one-line read on what kind of player this is. */
const verdict = (s: PlayerStatsData) => {
  const winRate = pct(s.wins, s.games);
  const sipsPer = s.games ? s.sips_taken / s.games : 0;
  if (s.games >= 3 && winRate >= 30) return "A genuine tycoon";
  if (s.games >= 3 && s.bankruptcies / s.games >= 0.6) return "Bankrupt more often than not";
  if (sipsPer >= 80) return "Drinks like it's their job";
  if (s.sips_given > s.sips_taken) return "Pours more than they drink";
  if (s.games >= 3 && s.jailed / s.games >= 1) return "Regular at the county jail";
  if (s.games >= 20) return "Part of the furniture";
  return "Still learning the board";
};

/* ─── 1. The deed with their name on it ───────────────────────────────────── */

const RankChip = ({ label, rank, of }: { label: string; rank: number; of: number }) => (
  <div className="flex min-w-0 flex-1 flex-col items-center gap-1 bg-background px-1 py-2.5">
    <span className="font-board text-lg font-semibold leading-none tabular-nums">{ordinal(rank)}</span>
    <span className="text-[9px] uppercase leading-none tracking-[0.16em] text-muted-foreground">
      {label} <span className="text-muted-foreground/60">/ {of}</span>
    </span>
  </div>
);

// Profile photo that opens full screen when tapped. Players without a photo
// (initials only) just render the plain avatar.
const EnlargeableAvatar = ({ name, url }: { name: string; url: string | null }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!url) return <PlayerAvatar player={{ name, avatar_url: url }} size="xl" />;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View ${name}'s photo`}
        className="block rounded-full transition-transform duration-200 ease-out hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
      >
        <PlayerAvatar player={{ name, avatar_url: url }} size="xl" />
      </button>
      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${name}'s photo`}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[100000] flex cursor-zoom-out flex-col items-center justify-center gap-4 bg-black/90 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-white hover:bg-white/20"
            >
              ×
            </button>
            <img
              src={url}
              alt={name}
              draggable={false}
              className="aspect-square w-[min(92vw,80vh)] rounded-[6px] object-cover shadow-2xl animate-in zoom-in-95 duration-200"
            />
            <div className="font-board text-2xl font-semibold uppercase tracking-[0.04em] text-white">{name}</div>
          </div>,
          document.body,
        )}
    </>
  );
};

const PlayerDeed = ({ s, isYou }: { s: PlayerStatsData; isYou?: boolean }) => {
  const color = playerColor(s.name);
  const fullName = s.account ? [s.account.first_name, s.account.last_name].filter(Boolean).join(" ") : "";
  const others = s.aliases.filter((a) => a !== s.name);
  return (
    <div className="relative w-full rounded-[6px] border-2 border-foreground/70 bg-background p-1.5">
      <div className="overflow-hidden border border-foreground/25">
        <div className="relative px-4 pb-14 pt-3 text-center" style={{ backgroundColor: streetColor(color) }}>
          <div className="font-board text-[10px] font-semibold uppercase leading-none tracking-[0.32em] text-black/60">
            {isYou ? "Your title deed" : "Title deed"}
          </div>
          {s.rank.of > 0 && s.games > 0 && (
            <div className="absolute right-2.5 top-2.5 rounded-full bg-black/15 px-2 py-1 font-board text-[9px] font-semibold uppercase leading-none tracking-[0.18em] text-black/70">
              #{s.rank.games} regular
            </div>
          )}
        </div>
        <div className="relative z-10 -mt-11 flex flex-col items-center px-4 text-center">
          <div className="rounded-full bg-background p-1.5 shadow-[0_10px_30px_-10px_rgb(0_0_0/0.8)]">
            <EnlargeableAvatar name={s.name} url={s.avatar_url} />
          </div>
          <h1 className="mt-3 w-full break-words font-board text-4xl font-semibold uppercase leading-none tracking-[0.04em] sm:text-5xl">
            {s.name}
          </h1>
          {(s.account || fullName) && (
            <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {fullName && fullName.toUpperCase() !== s.name && <span className="text-foreground">{fullName}</span>}
              {s.account && <span className="font-mono text-xs">@{s.account.username}</span>}
            </p>
          )}
          {s.account?.bio && <p className="mt-2 text-sm leading-snug text-muted-foreground">{s.account.bio}</p>}
          <p className="mt-3 font-board text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{verdict(s)}</p>
          {others.length > 0 && (
            <p className="mt-1.5 text-[11px] text-muted-foreground/80">Also plays as {others.join(", ")}</p>
          )}
        </div>

        {/* Headline record */}
        <div className="mx-4 mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-[4px] border border-foreground/25 bg-foreground/25">
          {[
            { label: "Games", value: s.games },
            { label: "Wins", value: s.wins },
            { label: "Win rate", value: pct(s.wins, s.games), format: (n: number) => `${Math.round(n)}%` },
          ].map((x) => (
            <div key={x.label} className="flex flex-col items-center gap-1.5 bg-background py-3">
              <span className="font-board text-3xl font-semibold leading-none">
                <CountUp value={x.value} format={x.format} />
              </span>
              <span className="text-[10px] uppercase leading-none tracking-[0.18em] text-muted-foreground">{x.label}</span>
            </div>
          ))}
        </div>

        <div className="mx-4 my-4 flex flex-col gap-2">
          <DeedRow label="Bankruptcies"><CountUp value={s.bankruptcies} /></DeedRow>
          <DeedRow label="Game nights"><CountUp value={s.nights} /></DeedRow>
          <DeedRow label="Hours at the table"><CountUp value={s.hours} format={(n) => n.toFixed(1).replace(/\.0$/, "")} /></DeedRow>
        </div>

        {s.rank.of > 0 && s.games > 0 && (
          <div className="flex gap-px border-t border-foreground/25 bg-foreground/25">
            <RankChip label="Games" rank={s.rank.games} of={s.rank.of} />
            <RankChip label="Sips" rank={s.rank.sips} of={s.rank.of} />
            <RankChip label="Wins" rank={s.rank.wins} of={s.rank.of} />
          </div>
        )}

        {(s.first_game || s.account?.created_at) && (
          <div className="flex items-center justify-between gap-3 border-t border-foreground/25 px-4 py-2.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <span>First roll {longDate((s.first_game ?? s.account?.created_at)!)}</span>
            {s.last_game && <span className="shrink-0">Last {ago(s.last_game)}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── 2. The tab ───────────────────────────────────────────────────────────── */

const TheTab = ({ s }: { s: PlayerStatsData }) => {
  const total = s.sips_taken + s.sips_given;
  const takenShare = pct(s.sips_taken, total);
  return (
    <Frame title="The Tab" note="Sips, all time" gridClassName="grid-cols-1">
      <div className="flex items-center gap-3 bg-background px-4 pb-4 pt-4">
        <div className="min-w-0 flex-1">
          <div className="font-board text-6xl font-semibold leading-none tracking-tight">
            <CountUp value={s.sips_taken} duration={1800} />
          </div>
          <div className="mt-2 font-board text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Sips taken</div>
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
            About <span className="text-foreground">{fmt(s.sips_taken / SIPS_PER_BEER)} beers</span>
            {s.games > 0 && (
              <>
                , or <span className="text-foreground">{Math.round(s.sips_taken / s.games)} sips</span> a game
              </>
            )}
            .
          </p>
        </div>
        <img
          src={ART.sips}
          alt=""
          aria-hidden
          draggable={false}
          className="h-24 w-24 shrink-0 -rotate-6 select-none object-contain drop-shadow-[0_10px_18px_rgb(0_0_0/0.6)]"
        />
      </div>

      {/* Taken vs given */}
      <div className="bg-background px-4 pb-4 pt-3">
        <div className="mb-2 flex items-baseline justify-between text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <span>Drank {takenShare}%</span>
          <span>Poured {100 - takenShare}%</span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-foreground/15" role="img" aria-label={`${takenShare}% taken, ${100 - takenShare}% given`}>
          <div className="h-full bg-foreground transition-[width] duration-700" style={{ width: `${takenShare}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px">
        {[
          { label: "Poured", value: s.sips_given },
          { label: "Rounds dealt", value: s.pours },
          { label: "Biggest pour", value: s.biggest_pour },
        ].map((x) => (
          <div key={x.label} className="flex flex-col items-center gap-1.5 bg-background py-3.5">
            <span className="font-board text-2xl font-semibold leading-none"><CountUp value={x.value} /></span>
            <span className="text-[10px] uppercase leading-none tracking-[0.14em] text-muted-foreground">{x.label}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
};

/* ─── 3. Around the board ──────────────────────────────────────────────────── */

const AroundTheBoard = ({ s }: { s: PlayerStatsData }) => (
  <Frame title="Around the Board" note="Their laps" gridClassName="grid-cols-3">
    <StatSpace label="Passed Go" art={ART.passGo} value={<CountUp value={s.passed_go} />} caption={`${perGame(s.passed_go, s.games)} / game`} />
    <StatSpace label="In Jail" art={ART.jail} value={<CountUp value={s.jailed} />} caption={`${plural(s.jail_cards, "card")} used`} />
    <StatSpace
      label="Free Parking"
      art={ART.freeParking}
      value={<CountUp value={s.free_parking_hits} />}
      caption={s.free_parking_best ? `Best ${money(s.free_parking_best)}` : "Never hit"}
    />
    <StatSpace label="Tax" band="red" art={ART.tax} value={<CountUp value={s.tax} format={money} />} caption="Paid in" />
    <StatSpace label="Trade Timer" band="yellow" art={ART.tradeTimer} value={<CountUp value={s.trade_timers} />} caption="Started" />
    <StatSpace
      label="Gambles"
      band="green"
      art={ART.money}
      value={<CountUp value={s.gambles} />}
      caption={s.gambles ? `${pct(s.gamble_wins, s.gambles)}% paid off` : "Plays it safe"}
    />
    <div className="col-span-full flex items-center gap-4 bg-background px-4 py-4">
      <div aria-hidden className="relative h-14 w-24 shrink-0">
        <img src={ART.bill50} alt="" draggable={false} className="absolute left-0 top-2 w-[78%] -rotate-[14deg] select-none drop-shadow-md" />
        <img src={ART.bill100} alt="" draggable={false} className="absolute left-[11%] top-1 w-[78%] -rotate-3 select-none drop-shadow-md" />
        <img src={ART.bill500} alt="" draggable={false} className="absolute left-[22%] top-0 w-[78%] rotate-[9deg] select-none drop-shadow-md" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-board text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Their bank statement</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="font-board text-xl font-semibold leading-none">
            <CountUp value={s.go_money + s.free_parking_money} format={money} />{" "}
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">collected</span>
          </span>
          <span className="font-board text-xl font-semibold leading-none">
            <CountUp value={s.tax + s.jail_fines} format={money} />{" "}
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">fined</span>
          </span>
        </div>
      </div>
    </div>
  </Frame>
);

/* ─── 4. Rivals ────────────────────────────────────────────────────────────── */

const RivalCard = ({ title, band, rival, line }: { title: string; band: PropertyColor; rival: Rival; line: string }) => (
  <Link
    to={playerPath(rival.name)}
    className="group flex min-w-0 flex-col overflow-hidden rounded-[6px] border-2 border-foreground/70 bg-background p-1 transition-transform duration-200 ease-out hover:-translate-y-1 hover:rotate-[-0.6deg] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
  >
    <div className="flex flex-1 flex-col border border-foreground/25">
      <div className="px-2 py-2 text-center" style={{ backgroundColor: streetColor(band) }}>
        <div className="truncate font-board text-[13px] font-semibold uppercase leading-none tracking-[0.12em] text-black/85">{title}</div>
      </div>
      <div className="flex flex-1 flex-col items-center px-2 pb-3 pt-3 text-center">
        <PlayerAvatar player={{ name: rival.name, avatar_url: rival.avatar_url }} size="lg" />
        <div className="mt-2 w-full truncate font-board text-lg font-semibold uppercase leading-none tracking-[0.04em]">{rival.name}</div>
        <div className="mt-1.5 font-board text-sm font-medium tabular-nums">{fmt(rival.sips)} sips</div>
        <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{line}</div>
      </div>
    </div>
  </Link>
);

const Rivals = ({ s }: { s: PlayerStatsData }) => {
  if (!s.nemesis && !s.victim) return null;
  return (
    <section className="w-full">
      <header className="mb-3 flex items-baseline justify-between gap-3 px-0.5">
        <h2 className="font-board text-[13px] font-semibold uppercase leading-none tracking-[0.22em]">Rivals</h2>
        <p className="text-[10px] uppercase leading-none tracking-[0.16em] text-muted-foreground">Who pours on who</p>
      </header>
      <div className="grid grid-cols-2 gap-3">
        {s.nemesis ? <RivalCard title="Nemesis" band="red" rival={s.nemesis} line="Pours on them the most" /> : <div />}
        {s.victim ? <RivalCard title="Favorite Target" band="light-blue" rival={s.victim} line="Gets their pours the most" /> : <div />}
      </div>
    </section>
  );
};

/* ─── 5. Personal bests ────────────────────────────────────────────────────── */

const PersonalBests = ({ s }: { s: PlayerStatsData }) => {
  const hasNights = s.weekdays?.length === 7 && s.weekdays.some((n) => n > 0);
  if (!s.wettest_game && !s.longest_game && !hasNights) return null;
  return (
    <Frame title="Personal Bests" note="Their records" gridClassName="grid-cols-1">
      {s.wettest_game && (
        <RecordRow
          art={ART.sips}
          title="Wettest game"
          value={<CountUp value={s.wettest_game.sips} />}
          detail={`${shortDate(s.wettest_game.date)} · ${s.wettest_game.players} players · ${s.wettest_game.code}`}
        />
      )}
      {s.longest_game && (
        <RecordRow
          art={ART.tradeTimer}
          title="Marathon game"
          value={`${s.longest_game.hours}h`}
          detail={`${shortDate(s.longest_game.date)} · ${s.longest_game.code}`}
        />
      )}
      {s.biggest_pour > 0 && <RecordRow art={ART.police} title="Biggest single pour" value={<CountUp value={s.biggest_pour} />} detail="Sips handed out in one go" />}
      {hasNights && <NightChart weekdays={s.weekdays} />}
    </Frame>
  );
};

/* ─── 6. Game log ──────────────────────────────────────────────────────────── */

const RESULT: Record<RecentGame["result"], { label: string; band?: PropertyColor }> = {
  won: { label: "Won", band: "green" },
  bankrupt: { label: "Bust", band: "red" },
  played: { label: "Played" },
};

const GameLog = ({ s }: { s: PlayerStatsData }) => {
  if (!s.recent?.length) return null;
  return (
    <Frame title="Game Log" note={`Last ${s.recent.length}`} gridClassName="grid-cols-1">
      {s.recent.map((g) => {
        const r = RESULT[g.result];
        return (
          <div key={`${g.code}-${g.date}`} className="flex items-center gap-3 bg-background px-3 py-2.5">
            <span
              className={cn(
                "w-14 shrink-0 rounded-[3px] py-1 text-center font-board text-[10px] font-semibold uppercase leading-none tracking-[0.16em]",
                r.band ? "text-black/85" : "border border-foreground/25 text-muted-foreground",
              )}
              style={r.band ? { backgroundColor: streetColor(r.band) } : undefined}
            >
              {r.label}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-sm leading-tight">{g.code}</span>
              <span className="block text-[11px] leading-tight text-muted-foreground">
                {shortDate(g.date)} · {g.players} players
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-board text-lg font-semibold leading-none tabular-nums">{fmt(g.sips_taken)}</span>
              <span className="block text-[9px] uppercase leading-tight tracking-[0.14em] text-muted-foreground">
                sips{g.sips_given ? ` · ${fmt(g.sips_given)} poured` : ""}
              </span>
            </span>
          </div>
        );
      })}
    </Frame>
  );
};

/* ─── Board ────────────────────────────────────────────────────────────────── */

/** The full stats layout for one player. */
export const PlayerStatsBoard = ({
  s,
  isYou,
  className,
  header,
}: {
  s: PlayerStatsData;
  isYou?: boolean;
  className?: string;
  /** Rendered between the deed and the rest (e.g. "edit profile"). */
  header?: ReactNode;
}) => (
  <div className={cn("flex w-full flex-col items-center gap-6", className)}>
    <Rise><PlayerDeed s={s} isYou={isYou} /></Rise>
    {header}
    {s.games > 0 ? (
      <>
        <Rise delay={80}><TheTab s={s} /></Rise>
        <Rise delay={140}><AroundTheBoard s={s} /></Rise>
        <Rise delay={180}><Rivals s={s} /></Rise>
        <Rise delay={200}><PersonalBests s={s} /></Rise>
        <Rise delay={220}><GameLog s={s} /></Rise>
      </>
    ) : (
      <Rise delay={80}>
        <div className="rounded-[6px] border-2 border-dashed border-foreground/30 px-6 py-8 text-center">
          <img src={ART.passGo} alt="" aria-hidden className="mx-auto h-16 w-16 object-contain opacity-80" />
          <p className="mt-3 font-board text-sm font-semibold uppercase tracking-[0.2em]">No games yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Stats show up here after a game with at least two players.</p>
        </div>
      </Rise>
    )}
  </div>
);

/** Placeholder shown while a player's stats load for the first time. */
export const PlayerStatsSkeleton = () => (
  <div className="flex w-full flex-col gap-6" aria-busy aria-label="Loading stats">
    <div className="h-[420px] w-full animate-pulse rounded-[6px] border-2 border-foreground/20 bg-foreground/[0.04]" />
    <div className="h-56 w-full animate-pulse rounded-[6px] border-2 border-foreground/20 bg-foreground/[0.04]" />
  </div>
);
