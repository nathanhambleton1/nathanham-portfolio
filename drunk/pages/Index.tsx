import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Clock, Trophy, Crown, Dices, Users, Spade } from "lucide-react";
import { GameCard } from "../components/GameCard";
import { BoardEdge, ColorBand, DeedFan } from "../components/BoardArt";
import { cn } from "@/lib/utils";

// Games hub at "/drunk": same visual language as the site home page
// (eyebrow + big display title, then a bento grid of cards).

const GAMES = [
  {
    title: "Drunkopoly",
    description: "Monopoly with a drinking twist. Live multiplayer banking, trades, jail and sips.",
    icon: Crown,
    path: "drunkopoly",
  },
  {
    title: "Blackjack",
    description: "Classic card game with drinking penalties.",
    icon: Spade,
    path: "blackjack",
  },
  {
    title: "Power Hour",
    description: "Sip of beer every minute for an hour.",
    icon: Clock,
    path: "power-hour",
  },
  {
    title: "Partner Tournament",
    description: "Build multi-game teams, schedules, and brackets.",
    icon: Users,
    path: "partner-tournament",
  },
  {
    title: "King's Cup",
    description: "Draw cards and see the rules.",
    icon: Dices,
    path: "kings-cup",
  },
  {
    title: "Beer Pong",
    description: "Track cups and scores for beer pong.",
    icon: Trophy,
    path: "beer-pong",
  },
];

// Grid footprint per game (3-column grid on desktop, 2 on tablet).
const LAYOUT: Record<string, string> = {
  drunkopoly: "sm:col-span-2 lg:row-span-2 min-h-[22rem]",
};

// Decorative artwork behind each card. Purely visual (aria-hidden).
const ART: Record<string, ReactNode> = {
  drunkopoly: (
    <>
      <BoardEdge className="absolute -right-6 top-0 w-[34rem] opacity-40 [mask-image:linear-gradient(to_left,black_30%,transparent)]" />
      <DeedFan className="absolute -right-4 bottom-10 h-56 w-56 rotate-[4deg] opacity-90 sm:right-6 sm:h-64 sm:w-64 [mask-image:linear-gradient(to_top,transparent,black_45%)]" />
    </>
  ),
  "power-hour": (
    <svg viewBox="0 0 100 100" className="absolute right-12 top-4 w-24 text-brand opacity-40">
      <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="62 252"
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
      />
    </svg>
  ),
  "beer-pong": (
    <svg viewBox="0 0 120 70" className="absolute right-12 top-5 w-32 text-foreground opacity-15">
      {[
        [10, 0], [32, 0], [54, 0], [76, 0],
        [21, 19], [43, 19], [65, 19],
        [32, 38], [54, 38],
        [43, 57],
      ].map(([x, y], i) => (
        <circle key={i} cx={x + 20} cy={y + 8} r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      ))}
    </svg>
  ),
  blackjack: (
    <div className="absolute right-12 top-5 flex opacity-30">
      <span className="h-16 w-11 -rotate-12 rounded-md border border-foreground/40 bg-background" />
      <span className="-ml-5 h-16 w-11 rotate-6 rounded-md border border-brand/60 bg-background" />
    </div>
  ),
};

const rise = (i: number): CSSProperties => ({ animationDelay: `${i * 70}ms` });

const Index = () => (
  <div className="min-h-screen bg-gradient-bg">
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 sm:pt-16">
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.03] px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-safe:animate-rise"
        style={rise(0)}
      >
        <ArrowLeft className="h-4 w-4" />
        nathanham.tech
      </Link>

      {/* Hero */}
      <section className="relative mt-12 sm:mt-16">
        <h1
          className="bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text pb-2 font-display text-6xl font-bold leading-[0.95] tracking-tight text-transparent sm:text-7xl lg:text-8xl motion-safe:animate-rise"
          style={rise(2)}
        >
          Drinking
          <br />
          Games
        </h1>
        <ColorBand className="mt-4 max-w-xs motion-safe:animate-rise" style={rise(3)} />
        <p className="mt-6 max-w-md text-sm text-muted-foreground sm:text-base motion-safe:animate-rise" style={rise(3)}>
          Pick a game, grab your friends, and please drink responsibly.
        </p>
      </section>

      {/* Games */}
      <section className="mt-16 sm:mt-20" aria-labelledby="games">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 id="games" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <span className="text-brand">//</span> Games
          </h2>
          <span className="text-xs text-muted-foreground">{GAMES.length} games</span>
        </div>
        <ul className="grid grid-flow-dense auto-rows-[minmax(13rem,auto)] gap-4 sm:grid-cols-2 lg:auto-rows-[13rem] lg:grid-cols-3">
          {GAMES.map((game, i) => (
            <li key={game.path} className={cn("motion-safe:animate-rise", LAYOUT[game.path])} style={rise(5 + i)}>
              <GameCard {...game} featured={game.path === "drunkopoly"} art={ART[game.path]} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  </div>
);

export default Index;
