import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { streetColor, type PropertyColor } from "./BoardArt";
import PlayerAvatar from "./PlayerAvatar";
import { ART, CountUp, SIPS_PER_BEER, DeedRow, Frame, NightChart, RecordRow, Rise, StatSpace, ago, daysSince, fmt, longDate, money, playerPath, plural, shortDate } from "./boardPieces";

/*
 * All-time Drunkopoly stats for the lobby, dressed as pieces of the board:
 * a title deed for the headline record, board spaces for the corner stats,
 * and award cards for the regulars. Data comes from the `drunkopoly_all_time_stats` SQL function
 * (supabase/drunkopoly_all_time_stats.sql) in one round trip.
 */

type Leader = {
  name: string;
  games: number;
  sips_taken: number;
  sips_given: number;
  bankruptcies: number;
  jailed: number;
  passed_go: number;
  wins: number;
  avatar_url: string | null;
};

type AllTimeStats = {
  first_game: string | null;
  last_game: string | null;
  games: number;
  nights: number;
  players: number;
  seats: number;
  hours: number;
  sips: number;
  pours: number;
  biggest_pour: number;
  passed_go: number;
  go_money: number;
  jailings: number;
  jail_fines: number;
  jail_cards: number;
  tax: number;
  free_parking_hits: number;
  free_parking_money: number;
  free_parking_jackpot: number;
  gambles: number;
  gamble_wins: number;
  trade_timers: number;
  bankruptcies: number;
  wettest_game: { code: string; date: string; sips: number; players: number } | null;
  longest_game: { code: string; date: string; hours: number } | null;
  months: { month: string; games: number; sips: number }[];
  weekdays: number[];
  leaders: Leader[];
};

const CACHE_KEY = "drunkopoly:allTimeStats";

/* ─── 1. The title deed ────────────────────────────────────────────────────── */

const TitleDeed = ({ s }: { s: AllTimeStats }) => (
  <div className="relative w-full rounded-[6px] border-2 border-foreground/70 bg-background p-1.5">
    <div className="border border-foreground/25">
      <div className="bg-foreground py-1.5 text-center font-board text-[12px] font-semibold uppercase leading-none tracking-[0.32em] text-background">
        Title Deed · All Time
      </div>
      <div className="relative flex items-center gap-2 px-4 pb-1 pt-4">
        <div className="min-w-0 flex-1">
          <div className="font-board text-6xl font-semibold leading-none tracking-tight sm:text-7xl">
            <CountUp value={s.sips} duration={1800} />
          </div>
          <div className="mt-2 font-board text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Sips poured</div>
        </div>
        <img
          src={ART.sips}
          alt=""
          aria-hidden
          draggable={false}
          className="h-24 w-24 shrink-0 -rotate-6 select-none object-contain drop-shadow-[0_10px_18px_rgb(0_0_0/0.6)] sm:h-28 sm:w-28"
        />
      </div>
      <p className="px-4 text-[13px] leading-snug text-muted-foreground">
        That's about <span className="text-foreground">{fmt(s.sips / SIPS_PER_BEER)} beers</span>, or one every{" "}
        <span className="text-foreground">{s.sips > 0 ? Math.max(1, Math.round((s.hours * 60) / (s.sips / SIPS_PER_BEER))) : 0} minutes</span> of play.
      </p>
      <div className="mx-4 my-4 flex flex-col gap-2 border-t border-foreground/15 pt-4">
        <DeedRow label="Games played"><CountUp value={s.games} /></DeedRow>
        <DeedRow label="Game nights"><CountUp value={s.nights} /></DeedRow>
        <DeedRow label="Hours at the table"><CountUp value={s.hours} /></DeedRow>
        <DeedRow label="Different players"><CountUp value={s.players} /></DeedRow>
        <DeedRow label="Bankruptcies filed"><CountUp value={s.bankruptcies} /></DeedRow>
        <DeedRow label="Rounds of sips dealt"><CountUp value={s.pours} /></DeedRow>
      </div>
      {s.first_game && (
        <div className="flex items-center justify-between gap-3 border-t border-foreground/25 px-4 py-2.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <span>Est. {longDate(s.first_game)}</span>
          {s.last_game && <span className="shrink-0">Last roll {ago(s.last_game)}</span>}
        </div>
      )}
    </div>
  </div>
);

/* ─── 2. Around the board ──────────────────────────────────────────────────── */

const AroundTheBoard = ({ s }: { s: AllTimeStats }) => {
  const paidOut = s.go_money + s.free_parking_money;
  const paidIn = s.tax + s.jail_fines;
  return (
    <Frame title="Around the Board" note="Every lap counted" gridClassName="grid-cols-3">
      <StatSpace label="Passed Go" art={ART.passGo} value={<CountUp value={s.passed_go} />} caption={`${money(s.go_money)} collected`} />
      <StatSpace label="In Jail" art={ART.jail} value={<CountUp value={s.jailings} />} caption={`${s.jail_cards} cards used`} />
      <StatSpace
        label="Free Parking"
        art={ART.freeParking}
        value={<CountUp value={s.free_parking_hits} />}
        caption={`Record ${money(s.free_parking_jackpot)}`}
      />
      <StatSpace label="Tax" band="red" art={ART.tax} value={<CountUp value={s.tax} format={money} />} caption="To the pot" />
      <StatSpace label="Trade Timer" band="yellow" art={ART.tradeTimer} value={<CountUp value={s.trade_timers} />} caption="Deals rushed" />
      <StatSpace
        label="Gambles"
        band="green"
        art={ART.money}
        value={<CountUp value={s.gambles} />}
        caption={s.gambles ? `${Math.round((s.gamble_wins / s.gambles) * 100)}% paid off` : "None yet"}
      />
      {/* The bank's ledger, with a little fan of play money */}
      <div className="col-span-full flex items-center gap-4 bg-background px-4 py-4">
        <div aria-hidden className="relative h-14 w-24 shrink-0">
          <img src={ART.bill50} alt="" draggable={false} className="absolute left-0 top-2 w-[78%] -rotate-[14deg] select-none drop-shadow-md" />
          <img src={ART.bill100} alt="" draggable={false} className="absolute left-[11%] top-1 w-[78%] -rotate-3 select-none drop-shadow-md" />
          <img src={ART.bill500} alt="" draggable={false} className="absolute left-[22%] top-0 w-[78%] rotate-[9deg] select-none drop-shadow-md" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-board text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">The Bank's ledger</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-board text-xl font-semibold leading-none">
              <CountUp value={paidOut} format={money} /> <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">paid out</span>
            </span>
            <span className="font-board text-xl font-semibold leading-none">
              <CountUp value={paidIn} format={money} /> <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">fined</span>
            </span>
          </div>
        </div>
      </div>
    </Frame>
  );
};

/* ─── 3. Hall of fame ──────────────────────────────────────────────────────── */

type Award = {
  title: string;
  band: PropertyColor;
  leader: Leader;
  stat: string;
  quip: string;
};

/**
 * Deeds are handed out in order of prestige, and — like a property — each
 * player can hold only one. Otherwise the most frequent player sweeps the lot.
 */
const buildAwards = (leaders: Leader[]): Award[] => {
  const awards: Award[] = [];
  const held = new Set<string>();
  const add = (title: string, band: PropertyColor, score: (l: Leader) => number, stat: (l: Leader) => string, quip: string, minGames = 1) => {
    const pool = leaders.filter((l) => !held.has(l.name) && l.games >= minGames && score(l) > 0);
    if (!pool.length) return;
    const leader = pool.reduce((best, l) => (score(l) > score(best) ? l : best), pool[0]);
    held.add(leader.name);
    awards.push({ title, band, leader, stat: stat(leader), quip });
  };
  const perGame = (n: number, l: Leader) => (n / l.games).toFixed(1).replace(/\.0$/, "");
  add("Tycoon", "green", (l) => l.wins, (l) => plural(l.wins, "win"), "Last one standing with cash");
  add("The Landlord", "dark-blue", (l) => l.games, (l) => plural(l.games, "game"), "Always has a seat at the table");
  add("Bottomless", "yellow", (l) => l.sips_taken, (l) => `${fmt(l.sips_taken)} sips`, "Drinks whatever is dealt");
  add("The Bartender", "pink", (l) => l.sips_given, (l) => `${fmt(l.sips_given)} poured`, "Generous with everyone else's liver");
  add("Heavyweight", "brown", (l) => l.sips_taken / l.games, (l) => `${Math.round(l.sips_taken / l.games)} sips / game`, "Goes hard every single night", 5);
  add("Rock Bottom", "red", (l) => l.bankruptcies, (l) => plural(l.bankruptcies, "bankruptcy", "bankruptcies"), "On a first-name basis with zero");
  add("Jailbird", "orange", (l) => l.jailed / l.games, (l) => `${perGame(l.jailed, l)} arrests / game`, "Knows the guards by name", 5);
  add("Lap Leader", "light-blue", (l) => l.passed_go / l.games, (l) => `${perGame(l.passed_go, l)} laps / game`, "Collects $200 like rent", 5);
  return awards;
};

const AwardCard = ({ award, style }: { award: Award; style?: CSSProperties }) => (
  <Link
    to={playerPath(award.leader.name)}
    style={style}
    aria-label={`${award.title}: ${award.leader.name}. View stats`}
    className="group flex min-w-0 flex-col overflow-hidden rounded-[6px] border-2 border-foreground/70 bg-background p-1 transition-transform duration-200 ease-out hover:-translate-y-1 hover:rotate-[-0.6deg] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:animate-rise"
  >
    <div className="flex flex-1 flex-col border border-foreground/25">
      <div className="px-2 py-2 text-center" style={{ backgroundColor: streetColor(award.band) }}>
        <div className="font-board text-[9px] font-medium uppercase leading-none tracking-[0.28em] text-black/60">Awarded to</div>
        <div className="mt-1 truncate font-board text-[13px] font-semibold uppercase leading-none tracking-[0.12em] text-black/85">{award.title}</div>
      </div>
      <div className="flex flex-1 flex-col items-center px-2 pb-3 pt-3 text-center">
        <PlayerAvatar player={{ name: award.leader.name, avatar_url: award.leader.avatar_url }} size="lg" />
        <div className="mt-2 w-full truncate font-board text-lg font-semibold uppercase leading-none tracking-[0.04em]">{award.leader.name}</div>
        <div className="mt-1.5 font-board text-sm font-medium tabular-nums">{award.stat}</div>
        <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{award.quip}</div>
        <div className="mt-auto pt-2.5 font-board text-[9px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/70 transition-colors group-hover:text-foreground">
          View stats →
        </div>
      </div>
    </div>
  </Link>
);

const HallOfFameCards = ({ s }: { s: AllTimeStats }) => {
  const awards = buildAwards(s.leaders);
  if (!awards.length) return null;
  return (
    <section className="w-full">
      <header className="mb-3 flex items-baseline justify-between gap-3 px-0.5">
        <h2 className="font-board text-[13px] font-semibold uppercase leading-none tracking-[0.22em]">Hall of Fame</h2>
        <p className="text-[10px] uppercase leading-none tracking-[0.16em] text-muted-foreground">Tap a deed for stats</p>
      </header>
      <div className="grid grid-cols-2 gap-3">
        {awards.map((a, i) => (
          <AwardCard key={a.title} award={a} style={{ animationDelay: `${80 + i * 50}ms` }} />
        ))}
      </div>
    </section>
  );
};

/* ─── 4. Record book ───────────────────────────────────────────────────────── */

const RecordBook = ({ s }: { s: AllTimeStats }) => (
  <Frame title="Record Book" note="Still standing" gridClassName="grid-cols-1">
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
    <RecordRow art={ART.police} title="Biggest single pour" value={<CountUp value={s.biggest_pour} />} detail="Sips handed out in one go" />
    <RecordRow art={ART.freeParking} title="Free Parking jackpot" value={money(s.free_parking_jackpot)} detail={`${money(s.free_parking_money)} paid from the pot in total`} />
    {s.weekdays?.length === 7 && <NightChart weekdays={s.weekdays} />}
  </Frame>
);

/* ─── Container ────────────────────────────────────────────────────────────── */

const readCache = (): AllTimeStats | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as AllTimeStats) : null;
  } catch {
    return null;
  }
};

const HallOfFame = ({ supabase, className }: { supabase: SupabaseClient; className?: string }) => {
  const [stats, setStats] = useState<AllTimeStats | null>(readCache);

  useEffect(() => {
    let alive = true;
    supabase.rpc("drunkopoly_all_time_stats").then(({ data, error }) => {
      if (!alive || error || !data) return;
      setStats(data as AllTimeStats);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      } catch {
        /* storage may be unavailable */
      }
    });
    return () => {
      alive = false;
    };
  }, [supabase]);

  if (!stats || !stats.games) return null;

  return (
    <div className={cn("flex w-full flex-col items-center gap-6", className)}>
      <Rise>
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-foreground/20" />
          <span className="font-board text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            {fmt(daysSince(stats.first_game ?? new Date().toISOString()))} days on the board
          </span>
          <span className="h-px flex-1 bg-foreground/20" />
        </div>
      </Rise>
      <Rise delay={60}><TitleDeed s={stats} /></Rise>
      <Rise delay={120}><AroundTheBoard s={stats} /></Rise>
      <HallOfFameCards s={stats} />
      <Rise delay={120}><RecordBook s={stats} /></Rise>
    </div>
  );
};

export default HallOfFame;
