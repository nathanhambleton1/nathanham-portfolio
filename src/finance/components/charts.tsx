// Charts, ported from nexafi/charts.py (Plotly) to Recharts.
//
// Colours come from the site theme (see the constants below), so charts
// follow the theme picker. One deliberate change from the Python:
//
//  LABELS, NOT JUST HOVER. Plotly used textinfo="none", so slice identity
//     was carried by colour alone and only a hover revealed it. Gold and pale
//     gold sit below 3:1 against the card, so each series is now named in a
//     legend with its value. Nothing is identifiable by colour alone, and the
//     numbers are readable without a mouse — which also makes them work on
//     touch and in print.

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { ReactNode } from "react";
import { fmtCompact, fmtMoney, type Decimal } from "../lib/money";
import { fmtMonthShort, type ISODate } from "../lib/dates";

// Theme-driven: every colour resolves from the site's CSS variables, so the
// charts follow the theme picker along with the rest of the page. ("GOLD" is
// the brand accent now; the name is kept so callers did not need to change.)
export const GOLD = "hsl(var(--brand))";
export const CHARCOAL = "hsl(var(--foreground) / 0.8)";
const GRID = "hsl(var(--foreground) / 0.08)";
const INK_MUTED = "hsl(var(--muted-foreground))";

/** Brand first, then alternating foreground/brand tints so neighbours contrast. */
export const CATEGORICAL = [
  "hsl(var(--brand))",
  "hsl(var(--foreground) / 0.85)",
  "hsl(var(--brand) / 0.45)",
  "hsl(var(--foreground) / 0.4)",
  "hsl(var(--foreground) / 0.18)",
];

const AXIS = {
  stroke: INK_MUTED,
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--background) / 0.9)",
  border: "1px solid hsl(var(--foreground) / 0.1)",
  borderRadius: 12,
  backdropFilter: "blur(16px)",
  color: "hsl(var(--foreground))",
  fontSize: 12,
  padding: "8px 10px",
} as const;

function tooltipProps(formatter: (value: number) => string) {
  return {
    contentStyle: TOOLTIP_STYLE,
    itemStyle: { color: "hsl(var(--foreground))" },
    labelStyle: { color: "hsl(var(--muted-foreground))", marginBottom: 4 },
    formatter: (value: number | string) => formatter(Number(value)),
    cursor: { fill: "hsl(var(--foreground) / 0.04)" },
  };
}

function ChartFrame({ height, children }: { height: number; children: ReactNode }) {
  return (
    <div className="chart" style={{ minHeight: height }}>
      <ResponsiveContainer width="100%" height={height}>
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

// --- spending donut ---------------------------------------------------------

export interface CategoryRow {
  name: string;
  amount: Decimal;
}

/**
 * Spending by top-level category.
 *
 * The legend beside the ring is the identity layer: every slice is named and
 * valued, so the chart still reads with the colours removed entirely.
 */
export function SpendingDonut({ rows }: { rows: CategoryRow[] }) {
  const data = rows
    .filter((row) => row.amount.greaterThan(0))
    .map((row) => ({ name: row.name, value: row.amount.toNumber() }));

  if (data.length === 0) {
    return (
      <div className="chart" style={{ display: "grid", placeItems: "center", minHeight: 265 }}>
        <p className="muted small-text">No spending in this period.</p>
      </div>
    );
  }

  const total = data.reduce((sum, row) => sum + row.value, 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(150px, 1fr) minmax(0, 1.1fr)", gap: 14, alignItems: "center" }}>
      <ChartFrame height={215}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="68%"
            outerRadius="100%"
            paddingAngle={1}
            // A surface-coloured ring is the 2px gap between segments.
            stroke="hsl(var(--background))"
            strokeWidth={3}
            isAnimationActive={false}
          >
            {data.map((row, index) => (
              <Cell key={row.name} fill={CATEGORICAL[index % CATEGORICAL.length]} />
            ))}
          </Pie>
          <Tooltip {...tooltipProps(fmtMoney)} />
        </PieChart>
      </ChartFrame>

      <ul style={{ display: "grid", gap: 7, margin: 0, padding: 0, listStyle: "none" }}>
        {data.map((row, index) => (
          <li key={row.name} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              aria-hidden="true"
              style={{
                flex: "none",
                width: 9,
                height: 9,
                borderRadius: 3,
                background: CATEGORICAL[index % CATEGORICAL.length],
                transform: "translateY(1px)",
              }}
            />
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {row.name}
            </span>
            <span className="amount" style={{ fontSize: 12 }}>
              {fmtMoney(row.value)}
            </span>
            <span className="muted" style={{ fontSize: 10, width: 34, textAlign: "right" }}>
              {total > 0 ? `${Math.round((row.value / total) * 100)}%` : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- monthly snapshot series ------------------------------------------------

export interface SnapshotPoint {
  month: ISODate;
  income: number;
  spending: number;
  netWorth: number;
  liquidCash: number;
}

function EmptySeries({ height, label }: { height: number; label: string }) {
  return (
    <div className="chart" style={{ display: "grid", placeItems: "center", minHeight: height }}>
      <p className="muted small-text">{label}</p>
    </div>
  );
}

/** Income against spending, month by month. Two series, so a legend is required. */
export function IncomeSpendingChart({ points }: { points: SnapshotPoint[] }) {
  if (points.length === 0) {
    return <EmptySeries height={270} label="No monthly snapshots saved yet." />;
  }
  const data = points.map((point) => ({
    label: fmtMonthShort(point.month),
    Income: point.income,
    Spending: point.spending,
  }));

  return (
    <ChartFrame height={270}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }} barGap={2}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis {...AXIS} width={54} tickFormatter={(value: number) => fmtCompact(value)} />
        <Tooltip {...tooltipProps(fmtMoney)} />
        <Legend
          verticalAlign="top"
          align="left"
          height={28}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, color: INK_MUTED }}
        />
        <Bar dataKey="Income" fill={CHARCOAL} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        <Bar dataKey="Spending" fill={GOLD} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
      </BarChart>
    </ChartFrame>
  );
}

/** Net worth over time. One series, so the card's title names it — no legend box. */
export function NetWorthChart({ points }: { points: SnapshotPoint[] }) {
  if (points.length === 0) {
    return <EmptySeries height={250} label="No monthly snapshots saved yet." />;
  }
  const data = points.map((point) => ({
    label: fmtMonthShort(point.month),
    "Net worth": point.netWorth,
  }));

  return (
    <ChartFrame height={250}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id="fin-networth-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity={0.18} />
            <stop offset="100%" stopColor={GOLD} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis {...AXIS} width={58} tickFormatter={(value: number) => fmtCompact(value)} />
        <Tooltip {...tooltipProps(fmtMoney)} cursor={{ stroke: INK_MUTED, strokeDasharray: "3 3" }} />
        <Area
          type="monotone"
          dataKey="Net worth"
          stroke={GOLD}
          strokeWidth={2}
          fill="url(#fin-networth-fill)"
          dot={false}
          activeDot={{ r: 5, stroke: "hsl(var(--background))", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartFrame>
  );
}

/** Liquid cash over time. */
export function CashChart({ points }: { points: SnapshotPoint[] }) {
  if (points.length === 0) {
    return <EmptySeries height={230} label="No monthly snapshots saved yet." />;
  }
  const data = points.map((point) => ({
    label: fmtMonthShort(point.month),
    "Liquid cash": point.liquidCash,
  }));

  return (
    <ChartFrame height={230}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis {...AXIS} width={58} tickFormatter={(value: number) => fmtCompact(value)} />
        <Tooltip {...tooltipProps(fmtMoney)} cursor={{ stroke: INK_MUTED, strokeDasharray: "3 3" }} />
        <Line
          type="linear"
          dataKey="Liquid cash"
          stroke={CHARCOAL}
          strokeWidth={2}
          dot={{ r: 4, fill: GOLD, stroke: "hsl(var(--background))", strokeWidth: 2 }}
          activeDot={{ r: 6, stroke: "hsl(var(--background))", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartFrame>
  );
}

// --- investments ------------------------------------------------------------

export interface InvestmentPoint {
  date: ISODate;
  marketValue: number;
  costBasis: number;
}

/**
 * Market value against cost basis. Both are dollars on one scale, so they
 * legitimately share an axis — the gap between the lines is the gain.
 */
export function InvestmentValueChart({ points }: { points: InvestmentPoint[] }) {
  if (points.length === 0) {
    return <EmptySeries height={280} label="No investment snapshots recorded yet." />;
  }
  const data = points.map((point) => ({
    label: point.date,
    "Market value": point.marketValue,
    "Cost basis": point.costBasis,
  }));

  return (
    <ChartFrame height={280}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis {...AXIS} width={62} tickFormatter={(value: number) => fmtCompact(value)} />
        <Tooltip {...tooltipProps(fmtMoney)} cursor={{ stroke: INK_MUTED, strokeDasharray: "3 3" }} />
        <Legend
          verticalAlign="top"
          align="left"
          height={28}
          iconType="plainline"
          iconSize={14}
          wrapperStyle={{ fontSize: 11, color: INK_MUTED }}
        />
        <Line
          type="linear"
          dataKey="Market value"
          stroke={GOLD}
          strokeWidth={2}
          dot={{ r: 4, fill: GOLD, stroke: "hsl(var(--background))", strokeWidth: 2 }}
          activeDot={{ r: 6, stroke: "hsl(var(--background))", strokeWidth: 2 }}
          isAnimationActive={false}
        />
        <Line
          type="linear"
          dataKey="Cost basis"
          stroke={CHARCOAL}
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
          activeDot={{ r: 5, stroke: "hsl(var(--background))", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartFrame>
  );
}
