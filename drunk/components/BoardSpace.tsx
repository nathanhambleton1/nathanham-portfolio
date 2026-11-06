import type { CSSProperties, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { streetColor, type PropertyColor } from "./BoardArt";

/*
 * Board-game action spaces for the Drunkopoly home screen.
 *
 * A <Board> is one stretch of the board: a heavy outer rule, a small caps
 * header, and spaces that share hairline borders (the grid's 1px gaps reveal
 * the frame colour behind them, so neighbouring spaces never double up lines).
 *
 * A <BoardSpace> reads like a property space: optional colour band, the name,
 * the artwork, and a "price" line at the bottom for live values.
 */

const SPACE_BASE =
  "group relative min-w-0 bg-background text-foreground transition-colors duration-150 hover:bg-foreground/[0.04] active:bg-foreground/[0.08] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground disabled:pointer-events-none disabled:opacity-50";

export const Board = ({
  title,
  note,
  cols = 3,
  children,
  className,
  style,
}: {
  title?: ReactNode;
  note?: ReactNode;
  cols?: 2 | 3;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) => (
  <section
    className={cn("w-full overflow-hidden rounded-[6px] border-2 border-foreground/70 bg-foreground/25", className)}
    style={style}
  >
    {title && (
      <header className="flex items-baseline justify-between gap-3 bg-background px-3 py-2">
        <h2 className="font-board text-[13px] font-semibold uppercase leading-none tracking-[0.22em]">{title}</h2>
        {note && (
          <p className="min-w-0 truncate text-[10px] uppercase leading-none tracking-[0.16em] text-muted-foreground">{note}</p>
        )}
      </header>
    )}
    <div className={cn("grid gap-px", title && "pt-px", cols === 2 ? "grid-cols-2" : "grid-cols-3")}>{children}</div>
  </section>
);

const SpaceArt = ({ art, icon }: { art?: string; icon?: ReactNode }) =>
  art ? (
    <img
      src={art}
      alt=""
      aria-hidden
      draggable={false}
      className="h-full w-full select-none object-contain transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-active:translate-y-0"
    />
  ) : (
    <span className="flex h-full w-full items-center justify-center text-foreground/80 [&_svg]:h-[62%] [&_svg]:w-[62%] [&_svg]:stroke-[1.25]">
      {icon}
    </span>
  );

export const BoardSpace = ({
  label,
  showLabel = true,
  value,
  art,
  icon,
  band,
  badge,
  onClick,
  disabled,
  className,
}: {
  /** Space name; always the accessible label. */
  label: string;
  /** Hide the printed name when the artwork already spells it out (e.g. PASS GO). */
  showLabel?: boolean;
  value?: ReactNode;
  art?: string;
  icon?: ReactNode;
  band?: PropertyColor;
  /** Small marker pinned to the space's top-right corner (e.g. dice when gambling is on). */
  badge?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className={cn(SPACE_BASE, "flex aspect-square flex-col text-center", className)}
  >
    {band && (
      <span aria-hidden className="h-[15%] shrink-0 border-b border-foreground/40" style={{ backgroundColor: streetColor(band) }} />
    )}
    {showLabel && (
      <span className="shrink-0 px-1.5 pt-[9%] font-board text-[13px] font-semibold uppercase leading-none tracking-[0.06em] sm:text-[15px]">
        {label}
      </span>
    )}
    <span className={cn("relative flex min-h-0 flex-1 items-center justify-center", showLabel ? "px-[10%] py-[5%]" : "px-[13%] pb-[6%] pt-[10%]")}>
      <SpaceArt art={art} icon={icon} />
    </span>
    <span className="block h-[1.9em] shrink-0 truncate px-1.5 font-board text-[11px] font-medium uppercase leading-none tracking-[0.12em] text-muted-foreground tabular-nums sm:text-xs">
      {value}
    </span>
    {badge && <span aria-hidden className={cn("pointer-events-none absolute right-1.5", band ? "top-[calc(15%+6px)]" : "top-1.5")}>{badge}</span>}
  </button>
);

/** A full-width space laid on its side: band down the left edge, art, then copy. */
export const WideSpace = ({
  title,
  value,
  art,
  band,
  onClick,
  className,
}: {
  title: string;
  value?: ReactNode;
  art: string;
  band?: PropertyColor;
  onClick?: () => void;
  className?: string;
}) => (
  <button type="button" onClick={onClick} className={cn(SPACE_BASE, "col-span-full flex items-stretch text-left", className)}>
    {band && <span aria-hidden className="w-3 shrink-0 border-r border-foreground/40" style={{ backgroundColor: streetColor(band) }} />}
    <span className="flex h-[5.5rem] w-[5.5rem] shrink-0 items-center justify-center p-2.5 sm:h-24 sm:w-24">
      <SpaceArt art={art} />
    </span>
    <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-3 pr-2">
      <span className="font-board text-xl font-semibold uppercase leading-none tracking-[0.04em]">{title}</span>
      {value && <span className="font-sans text-[13px] leading-snug text-muted-foreground">{value}</span>}
    </span>
    <ChevronRight aria-hidden className="mr-3 h-5 w-5 shrink-0 self-center text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
  </button>
);

/** A slim full-width line at the foot of a board (e.g. Declare Bankruptcy). */
export const BoardLine = ({
  children,
  onClick,
  tone = "default",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "default" | "danger";
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      SPACE_BASE,
      "col-span-full flex items-center justify-center gap-2 py-3.5 font-board text-[13px] font-semibold uppercase tracking-[0.2em]",
      tone === "danger" && "text-destructive hover:bg-destructive/[0.07] active:bg-destructive/[0.12]",
    )}
  >
    {children}
  </button>
);
