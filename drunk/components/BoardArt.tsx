import { useId, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type PropertyColor = "brown" | "light-blue" | "pink" | "orange" | "red" | "yellow" | "green" | "dark-blue";

// Flat, printed-ink versions of the classic street groups — slightly muted so
// they read like ink on a board rather than glowing UI colours.
const PROPERTY_COLORS: Record<PropertyColor, { bg: string }> = {
  brown: { bg: "#7B4A2D" },
  "light-blue": { bg: "#9CC9DD" },
  pink: { bg: "#C2457F" },
  orange: { bg: "#DB8A2E" },
  red: { bg: "#C23A2E" },
  yellow: { bg: "#E2B52F" },
  green: { bg: "#2F7D4F" },
  "dark-blue": { bg: "#2B4C86" },
};

export const streetColor = (c: PropertyColor) => PROPERTY_COLORS[c].bg;

// Original, hand-drawn board-game artwork (dice, houses, hotels, deed cards,
// property colour bands, a board edge). Everything is inline SVG / CSS so it
// themes with currentColor + the site tokens and needs no external assets.
// No trademarked artwork is used — only generic street-group colours.

export const STREET_GROUPS: PropertyColor[] = [
  "brown",
  "light-blue",
  "pink",
  "orange",
  "red",
  "yellow",
  "green",
  "dark-blue",
];

const groupColor = (c: PropertyColor) => PROPERTY_COLORS[c].bg;

/* ─── Property colour band ─────────────────────────────────────────────────── */

/** A thin segmented strip of the eight street colours. */
export const ColorBand = ({ className, style }: { className?: string; style?: CSSProperties }) => (
  <div aria-hidden className={cn("flex h-1.5 w-full gap-1", className)} style={style}>
    {STREET_GROUPS.map((c) => (
      <span key={c} className="flex-1 rounded-full" style={{ backgroundColor: groupColor(c) }} />
    ))}
  </div>
);

/* ─── Dice ─────────────────────────────────────────────────────────────────── */

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
};

/** A single die. Outline + pips use currentColor; fill is the page background. */
export const Die = ({ value = 5, className, style }: { value?: number; className?: string; style?: CSSProperties }) => (
  <svg viewBox="0 0 100 100" aria-hidden className={className} style={style}>
    <rect x="4" y="4" width="92" height="92" rx="20" fill="hsl(var(--background))" stroke="currentColor" strokeWidth="4" />
    <rect x="12" y="10" width="76" height="6" rx="3" fill="currentColor" opacity="0.12" />
    {(PIPS[value] ?? PIPS[5]).map(([cx, cy], i) => (
      <circle key={i} cx={cx} cy={cy} r="8" fill="currentColor" />
    ))}
  </svg>
);

/** Two dice tumbling, used as hero/card decoration. */
export const DicePair = ({ className, a = 5, b = 3 }: { className?: string; a?: number; b?: number }) => (
  <div aria-hidden className={cn("relative", className)}>
    <Die value={a} className="absolute left-0 top-0 h-[58%] w-[58%] -rotate-12" />
    <Die value={b} className="absolute bottom-0 right-0 h-[52%] w-[52%] rotate-[18deg]" />
  </div>
);

/* ─── Houses & hotels ──────────────────────────────────────────────────────── */

export const House = ({ className, color = "currentColor" }: { className?: string; color?: string }) => (
  <svg viewBox="0 0 40 40" aria-hidden className={className}>
    <path d="M6 19 L20 6 L34 19 V34 H6 Z" fill={color} />
    <rect x="16" y="23" width="8" height="11" rx="1" fill="hsl(var(--background))" opacity="0.55" />
  </svg>
);

export const Hotel = ({ className, color = "currentColor" }: { className?: string; color?: string }) => (
  <svg viewBox="0 0 64 40" aria-hidden className={className}>
    <path d="M4 16 L32 4 L60 16 V36 H4 Z" fill={color} />
    {[12, 22, 38, 48].map((x) => (
      <rect key={x} x={x} y="20" width="5" height="5" rx="1" fill="hsl(var(--background))" opacity="0.55" />
    ))}
    <rect x="28" y="24" width="8" height="12" rx="1" fill="hsl(var(--background))" opacity="0.55" />
  </svg>
);

/** A row of four houses + a hotel in the street colours. */
export const Skyline = ({ className }: { className?: string }) => (
  <div aria-hidden className={cn("flex items-end gap-1.5", className)}>
    <House className="h-6 w-6" color={groupColor("green")} />
    <House className="h-6 w-6" color={groupColor("green")} />
    <House className="h-6 w-6" color={groupColor("green")} />
    <House className="h-6 w-6" color={groupColor("green")} />
    <Hotel className="h-8 w-12" color={groupColor("red")} />
  </div>
);

/* ─── Title-deed style card ────────────────────────────────────────────────── */

/** An abstract deed card: colour header, title bar and rent "lines". */
export const DeedCard = ({
  color = "dark-blue",
  className,
  style,
}: {
  color?: PropertyColor;
  className?: string;
  style?: CSSProperties;
}) => (
  <div
    aria-hidden
    className={cn(
      "flex aspect-[5/7] flex-col overflow-hidden rounded-xl border border-foreground/15 bg-background shadow-[0_20px_40px_-18px_rgb(0_0_0/0.8),inset_0_1px_0_0_hsl(var(--foreground)/0.08)]",
      className,
    )}
    style={style}
  >
    <div className="m-2 mb-0 flex h-[24%] flex-col items-center justify-center gap-1 rounded-md" style={{ backgroundColor: groupColor(color) }}>
      <span className="h-1 w-1/3 rounded-full bg-black/25" />
      <span className="h-1.5 w-2/3 rounded-full bg-black/35" />
    </div>
    <div className="flex flex-1 flex-col justify-center gap-[9%] px-[12%]">
      {[100, 80, 80, 80, 80, 60].map((w, i) => (
        <div key={i} className="flex items-center justify-between gap-2">
          <span className="h-1 rounded-full bg-foreground/20" style={{ width: `${w * 0.55}%` }} />
          <span className="h-1 w-[18%] rounded-full bg-foreground/30" />
        </div>
      ))}
    </div>
  </div>
);

/** Three deed cards fanned out. */
export const DeedFan = ({ className }: { className?: string }) => (
  <div aria-hidden className={cn("relative", className)}>
    <DeedCard color="orange" className="absolute left-0 top-[8%] w-[46%] -rotate-[14deg]" />
    <DeedCard color="red" className="absolute left-[27%] top-0 w-[46%] -rotate-2" />
    <DeedCard color="dark-blue" className="absolute left-[54%] top-[8%] w-[46%] rotate-[12deg]" />
  </div>
);

/* ─── Board edge ───────────────────────────────────────────────────────────── */

/**
 * A run of board spaces (street tiles with colour bars, plus blank "special"
 * spaces). Purely decorative — sits behind heroes and cards.
 */
export const BoardEdge = ({ className, tiles = 11 }: { className?: string; tiles?: number }) => {
  const pattern: (PropertyColor | null)[] = [];
  STREET_GROUPS.forEach((c, i) => {
    pattern.push(c, c);
    if (i % 2 === 1) pattern.push(null);
  });
  const row = Array.from({ length: tiles }, (_, i) => pattern[i % pattern.length]);
  return (
    <div aria-hidden className={cn("flex", className)}>
      {row.map((c, i) => (
        <div key={i} className="flex aspect-[3/5] flex-1 flex-col border border-foreground/15 bg-foreground/[0.02]">
          {c ? (
            <span className="h-[22%] border-b border-foreground/15" style={{ backgroundColor: groupColor(c) }} />
          ) : (
            <span className="m-auto h-1/4 w-1/2 rounded-full border border-foreground/20" />
          )}
        </div>
      ))}
    </div>
  );
};

/* ─── Banknote ─────────────────────────────────────────────────────────────── */

// Classic play-money paper colours, by denomination.
const NOTE_COLORS: Record<number, string> = {
  1: "#f3efe4",
  5: "#f1bccb",
  10: "#f3df8c",
  20: "#b8dca6",
  50: "#b9a9e3",
  100: "#e8cfa6",
  500: "#f2a93a",
};
const NOTE_INK = "#2a2118";

/** A vintage play-money note: coloured paper, engraved frame, guilloche oval. */
export const Banknote = ({ value = 500, className, style }: { value?: number; className?: string; style?: CSSProperties }) => {
  const uid = useId().replace(/:/g, "");
  const hatch = `bn-hatch-${uid}`;
  const fine = `bn-fine-${uid}`;
  const paper = NOTE_COLORS[value] ?? NOTE_COLORS[500];
  const label = String(value);
  const big = label.length >= 3 ? 30 : label.length === 2 ? 34 : 38;
  return (
    <div
      aria-hidden
      className={cn("aspect-[2/1] overflow-hidden rounded-[3px] shadow-[0_10px_24px_-12px_rgb(0_0_0/0.8)]", className)}
      style={{ backgroundColor: paper, ...style }}
    >
      <svg viewBox="0 0 200 100" className="block h-full w-full" fill="none" stroke={NOTE_INK} style={{ fontFamily: "inherit" }}>
        <defs>
          <pattern id={hatch} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="3" strokeWidth="1" />
          </pattern>
          <pattern id={fine} width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
            <line x1="0" y1="0" x2="0" y2="2.4" strokeWidth="0.35" opacity="0.55" />
          </pattern>
        </defs>

        {/* Engraved border band */}
        <rect x="5" y="5" width="190" height="90" strokeWidth="1.2" />
        <path d="M8 8h184v84H8z M14 14v72h172V14z" fill={`url(#${hatch})`} fillRule="evenodd" stroke="none" opacity="0.7" />
        <rect x="14" y="14" width="172" height="72" strokeWidth="0.9" />

        {/* Fine-line field */}
        <rect x="16" y="16" width="168" height="68" fill={`url(#${fine})`} stroke="none" />

        {/* Title banner */}
        <rect x="62" y="9" width="76" height="14" fill={paper} strokeWidth="1.1" />
        <text x="100" y="19.6" textAnchor="middle" fill={NOTE_INK} stroke="none" fontSize="9" fontWeight="800" letterSpacing="0.6">
          DRUNKOPOLY
        </text>

        {/* Guilloche oval */}
        <ellipse cx="100" cy="56" rx="40" ry="26" fill={paper} strokeWidth="1" />
        {[36, 32, 28].map((rx, i) => (
          <ellipse key={rx} cx="100" cy="56" rx={rx} ry={rx * 0.65} strokeWidth="0.3" opacity={0.35 - i * 0.08} />
        ))}
        <text x="100" y={56 + big * 0.36} textAnchor="middle" fill={NOTE_INK} stroke="none" fontSize={big} fontWeight="900" letterSpacing="-1">
          {label}
        </text>

        {/* Corner value boxes */}
        <rect x="22" y="22" width="26" height="18" fill={paper} strokeWidth="0.9" />
        <text x="35" y="34.5" textAnchor="middle" fill={NOTE_INK} stroke="none" fontSize={label.length >= 3 ? 9 : 11} fontWeight="800">{label}</text>
        <rect x="152" y="60" width="26" height="18" fill={paper} strokeWidth="0.9" />
        <text x="165" y="72.5" textAnchor="middle" fill={NOTE_INK} stroke="none" fontSize={label.length >= 3 ? 9 : 11} fontWeight="800">{label}</text>

        {/* House + mug emblems */}
        <rect x="22" y="56" width="22" height="22" fill={paper} strokeWidth="0.9" />
        <path d="M33 60l-7 6h2v8h10v-8h2z" fill={`url(#${hatch})`} strokeWidth="0.9" strokeLinejoin="round" />
        <rect x="156" y="22" width="22" height="22" fill={paper} strokeWidth="0.9" />
        <path d="M161 28h9v11h-9z M170 30.5h2.5a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5H170" fill={`url(#${hatch})`} strokeWidth="0.9" strokeLinejoin="round" />
      </svg>
    </div>
  );
};
