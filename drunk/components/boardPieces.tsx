import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { streetColor, type PropertyColor } from "./BoardArt";

/* Shared board-styled stat pieces for the Hall of Fame and player pages. */

/** Where a player's page lives; names are matched case-insensitively. */
export const playerPath = (name: string) => `/drunk/drunkopoly/player/?name=${encodeURIComponent(name.trim().toLowerCase())}`;

export const ART = {
  passGo: "/drunkopoly/pass_go.webp",
  jail: "/drunkopoly/in_jail.webp",
  freeParking: "/drunkopoly/free_parking.webp",
  tax: "/drunkopoly/luxury_tax.webp",
  tradeTimer: "/drunkopoly/trade_timer.webp",
  money: "/drunkopoly/play_money.webp",
  sips: "/drunkopoly/sips.webp",
  police: "/drunkopoly/police.webp",
  bank: "/drunkopoly/bank.webp",
  bill50: "/drunkopoly/bill_50.webp",
  bill100: "/drunkopoly/bill_100.webp",
  bill500: "/drunkopoly/bill_500.webp",
} as const;

export const DAY_NAMES = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
export const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/* ─── Formatting ───────────────────────────────────────────────────────────── */

export const fmt = (n: number) => Math.round(n).toLocaleString();

export const compact = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)}K`;
  if (Math.abs(n) >= 1_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return fmt(n);
};

export const money = (n: number) => `$${compact(n)}`;

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

export const daysSince = (iso: string) => Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

export const ago = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
};

export const plural = (n: number, one: string, many = `${one}s`) => `${fmt(n)} ${n === 1 ? one : many}`;

/* ─── Count-up numbers ─────────────────────────────────────────────────────── */

export const prefersReducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

/** Counts from 0 to `value` the first time it scrolls into view. */
export const CountUp = ({ value, format = fmt, duration = 1400 }: { value: number; format?: (n: number) => string; duration?: number }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) {
      setShown(value);
      return;
    }
    let raf = 0;
    const run = () => {
      started.current = true;
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        setShown(value * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    if (started.current) {
      setShown(value);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          run();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {format(shown)}
    </span>
  );
};

/* ─── Shared board pieces ──────────────────────────────────────────────────── */

export const Rise = ({ delay = 0, className, children }: { delay?: number; className?: string; children: ReactNode }) => (
  <div className={cn("w-full motion-safe:animate-rise", className)} style={{ animationDelay: `${delay}ms` }}>
    {children}
  </div>
);

export const Frame = ({
  title,
  note,
  className,
  gridClassName,
  children,
}: {
  title: ReactNode;
  note?: ReactNode;
  className?: string;
  gridClassName?: string;
  children: ReactNode;
}) => (
  <section className={cn("w-full overflow-hidden rounded-[6px] border-2 border-foreground/70 bg-foreground/25", className)}>
    <header className="flex items-baseline justify-between gap-3 bg-background px-3 py-2">
      <h2 className="font-board text-[13px] font-semibold uppercase leading-none tracking-[0.22em]">{title}</h2>
      {note && <p className="min-w-0 truncate text-[10px] uppercase leading-none tracking-[0.16em] text-muted-foreground">{note}</p>}
    </header>
    <div className={cn("grid gap-px pt-px", gridClassName)}>{children}</div>
  </section>
);

/** A read-only board space: name, artwork, then the stat set like a price. */
export const StatSpace = ({
  label,
  art,
  band,
  value,
  caption,
}: {
  label: string;
  art: string;
  band?: PropertyColor;
  value: ReactNode;
  caption: ReactNode;
}) => (
  <div className="group flex min-w-0 flex-col bg-background text-center">
    {band && <span aria-hidden className="h-2.5 shrink-0 border-b border-foreground/40" style={{ backgroundColor: streetColor(band) }} />}
    <span className="px-1.5 pt-3 font-board text-[11px] font-semibold uppercase leading-none tracking-[0.1em] sm:text-xs">{label}</span>
    <span className="flex h-16 items-center justify-center px-[18%] py-2 sm:h-20">
      <img
        src={art}
        alt=""
        aria-hidden
        draggable={false}
        loading="lazy"
        className="h-full w-full select-none object-contain transition-transform duration-300 ease-out group-hover:-rotate-3 group-hover:scale-105"
      />
    </span>
    <span className="font-board text-2xl font-semibold leading-none tracking-tight sm:text-[28px]">{value}</span>
    <span className="block truncate px-1.5 pb-3 pt-1.5 text-[10px] uppercase leading-none tracking-[0.12em] text-muted-foreground">
      {caption}
    </span>
  </div>
);

export const DeedRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-baseline gap-2 text-sm">
    <span className="shrink-0 text-muted-foreground">{label}</span>
    <span aria-hidden className="mb-1 min-w-4 flex-1 border-b border-dotted border-foreground/25" />
    <span className="shrink-0 font-board text-base font-semibold tabular-nums">{children}</span>
  </div>
);

export const RecordRow = ({ art, title, value, detail }: { art: string; title: string; value: ReactNode; detail?: ReactNode }) => (
  <div className="col-span-full flex items-center gap-3 bg-background py-3 pl-3 pr-4">
    <span className="flex h-14 w-14 shrink-0 items-center justify-center">
      <img src={art} alt="" aria-hidden draggable={false} loading="lazy" className="h-full w-full select-none object-contain" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block font-board text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</span>
      {detail && <span className="mt-1 block truncate text-[12px] text-muted-foreground">{detail}</span>}
    </span>
    <span className="shrink-0 text-right font-board text-2xl font-semibold leading-none tabular-nums">{value}</span>
  </div>
);

export const NightChart = ({ weekdays, noun = "game" }: { weekdays: number[]; noun?: string }) => {
  const max = Math.max(1, ...weekdays);
  const top = weekdays.indexOf(max);
  return (
    <div className="col-span-full flex items-end gap-3 bg-background px-4 pb-3 pt-4">
      <div className="min-w-0 flex-1">
        <div className="font-board text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Favorite night</div>
        <div className="mt-1.5 font-board text-2xl font-semibold leading-none">{DAY_NAMES[top]}</div>
        <div className="mt-1 text-[12px] text-muted-foreground">{plural(max, noun)} started</div>
      </div>
      <div className="flex h-14 shrink-0 items-end gap-1.5" role="img" aria-label={weekdays.map((n, i) => `${DAY_NAMES[i]} ${n}`).join(", ")}>
        {weekdays.map((n, i) => (
          <div key={i} className="flex h-full w-4 flex-col items-center justify-end gap-1">
            <div
              className={cn("w-full rounded-t-[2px]", i === top ? "bg-foreground" : "bg-foreground/25")}
              style={{ height: `${Math.max(6, (n / max) * 100)}%` }}
            />
            <span className="text-[9px] leading-none text-muted-foreground">{DAY_LETTERS[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
