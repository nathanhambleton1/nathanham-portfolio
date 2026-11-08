import { useEffect, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { LiveDot } from "./LiveDot";
import { CountUp, DeedRow, Frame, Rise, ago, fmt, longDate, plural } from "./boardPieces";

/*
 * Owner-only site analytics for Drunkopoly, under the Hall of Fame in the lobby.
 * Data comes from drunkopoly_site_stats() (supabase/drunkopoly_site_analytics.sql),
 * which returns null for anyone but @nathan_ham. Views are recorded by
 * drunk/lib/drunkAnalytics.ts.
 */

type Source = "qr" | "invite_link" | "referral" | "direct";

type Visit = {
  started: string;
  last_seen: string;
  secs: number;
  views: number;
  source: Source;
  game_code: string | null;
  username: string | null;
  player_name: string | null;
  device: string;
  referrer: string | null;
  played: boolean;
};

type SiteStats = {
  first_view: string | null;
  views: number;
  visitors: number;
  sessions: number;
  returning: number;
  live_now: number;
  views_today: number;
  visitors_today: number;
  visitors_7d: number;
  hours: number;
  game_hours: number;
  avg_session_secs: number;
  longest_session_secs: number;
  pages_per_session: number;
  signed_in_share: number;
  days: { day: string; views: number; visitors: number }[];
  hours_of_day: number[];
  devices: Record<string, number>;
  pages: { page: string; views: number; secs: number }[];
  sources: Partial<Record<Source, number>>;
  qr_scans: number;
  qr_joined: number;
  recent: Visit[];
  referrers: { host: string; views: number }[];
};

const REFRESH_MS = 60_000;

const SOURCE_LABEL: Record<Source, string> = {
  qr: "Scanned QR",
  invite_link: "Invite link",
  referral: "Referral",
  direct: "Typed / bookmark",
};

const PAGE_LABEL: Record<string, string> = {
  lobby: "Lobby",
  game: "In a game",
  rules: "Rules",
  messages: "Messages",
  player: "Player profiles",
  other: "Other",
};

const duration = (secs: number) => {
  const s = Math.max(0, Math.round(secs));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;

/** A board space without artwork: label, big number, caption. */
const Cell = ({ label, value, caption }: { label: ReactNode; value: ReactNode; caption: ReactNode }) => (
  <div className="flex min-w-0 flex-col items-center bg-background px-1.5 py-3 text-center">
    <span className="flex items-center gap-1.5 font-board text-[11px] font-semibold uppercase leading-none tracking-[0.1em]">{label}</span>
    <span className="mt-2.5 font-board text-2xl font-semibold leading-none tracking-tight tabular-nums sm:text-[28px]">{value}</span>
    <span className="mt-1.5 block max-w-full truncate text-[10px] uppercase leading-none tracking-[0.12em] text-muted-foreground">{caption}</span>
  </div>
);

const Panel = ({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) => (
  <div className="col-span-full bg-background px-4 py-4">
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <span className="font-board text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</span>
      {aside && <span className="text-[11px] text-muted-foreground">{aside}</span>}
    </div>
    {children}
  </div>
);

/** Labelled horizontal bar, sized against the biggest value in its group. */
const BarRow = ({ label, value, max, detail }: { label: ReactNode; value: number; max: number; detail?: ReactNode }) => (
  <div className="flex items-center gap-3 text-sm">
    <span className="w-28 shrink-0 truncate text-muted-foreground">{label}</span>
    <span className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-foreground/10">
      <span className="absolute inset-y-0 left-0 rounded-full bg-foreground" style={{ width: `${max ? Math.max(3, (value / max) * 100) : 0}%` }} />
    </span>
    <span className="w-16 shrink-0 text-right font-board font-semibold tabular-nums">
      {fmt(value)}
      {detail && <span className="ml-1 text-[10px] font-normal text-muted-foreground">{detail}</span>}
    </span>
  </div>
);

const DailyChart = ({ days }: { days: SiteStats["days"] }) => {
  const max = Math.max(1, ...days.map((d) => d.views));
  const total = days.reduce((n, d) => n + d.views, 0);
  return (
    <Panel title="Last 30 days" aside={plural(total, "view")}>
      <div
        className="flex h-20 items-end gap-[3px]"
        role="img"
        aria-label={days.map((d) => `${d.day}: ${d.views} views, ${d.visitors} visitors`).join("; ")}
      >
        {days.map((d, i) => (
          <div
            key={d.day}
            title={`${new Date(`${d.day}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${plural(d.views, "view")} · ${plural(d.visitors, "visitor")}`}
            className={cn("min-w-0 flex-1 rounded-t-[2px]", i === days.length - 1 ? "bg-foreground" : "bg-foreground/35")}
            style={{ height: `${d.views ? Math.max(6, (d.views / max) * 100) : 2}%` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
        <span>30 days ago</span>
        <span>Today</span>
      </div>
    </Panel>
  );
};

const HourChart = ({ hours }: { hours: number[] }) => {
  const max = Math.max(1, ...hours);
  const top = hours.indexOf(max);
  return (
    <Panel title="Busiest hour" aside={max > 1 ? `${hourLabel(top)} · ${plural(max, "view")}` : undefined}>
      <div className="flex h-12 items-end gap-[2px]" role="img" aria-label={hours.map((n, h) => `${hourLabel(h)} ${n}`).join(", ")}>
        {hours.map((n, h) => (
          <div
            key={h}
            title={`${hourLabel(h)} · ${plural(n, "view")}`}
            className={cn("min-w-0 flex-1 rounded-t-[2px]", h === top && n ? "bg-foreground" : "bg-foreground/25")}
            style={{ height: `${n ? Math.max(8, (n / max) * 100) : 4}%` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
        <span>12am</span>
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
        <span>11pm</span>
      </div>
    </Panel>
  );
};

const who = (v: Visit) => (v.username ? `@${v.username}` : v.player_name ? v.player_name : "Anonymous");

const RecentVisits = ({ visits }: { visits: Visit[] }) => (
  <Panel title="Recent visits" aside="Newest first">
    <ul className="-mx-1 flex flex-col">
      {visits.map((v, i) => {
        const live = Date.now() - new Date(v.last_seen).getTime() < 120_000;
        return (
          <li key={`${v.started}-${i}`} className="flex items-center gap-3 border-t border-foreground/10 px-1 py-2.5 first:border-t-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {live && <LiveDot />}
                <span className={cn("truncate font-board text-sm font-semibold", !v.username && !v.player_name && "text-muted-foreground")}>{who(v)}</span>
                {v.username && v.player_name && v.player_name.toLowerCase() !== v.username.toLowerCase() && (
                  <span className="truncate text-xs text-muted-foreground">as {v.player_name}</span>
                )}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {SOURCE_LABEL[v.source] ?? v.source}
                {v.game_code && ` · ${v.game_code}`}
                {v.source === "referral" && v.referrer && ` · ${v.referrer}`}
                {` · ${v.device}`}
                {v.played && " · played"}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-board text-sm font-semibold tabular-nums">{duration(v.secs)}</div>
              <div className="text-[10px] text-muted-foreground">{ago(v.started)}</div>
            </div>
          </li>
        );
      })}
    </ul>
  </Panel>
);

const SiteTraffic = ({ supabase, className }: { supabase: SupabaseClient; className?: string }) => {
  const [stats, setStats] = useState<SiteStats | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      supabase.rpc("drunkopoly_site_stats").then(({ data, error }) => {
        if (!alive || error || !data || typeof data !== "object") return;
        // Fill in anything an older version of the SQL function doesn't return,
        // so a schema mismatch can never crash the lobby.
        const d = data as Partial<SiteStats>;
        setStats({
          ...(d as SiteStats),
          days: Array.isArray(d.days) ? d.days : [],
          hours_of_day: Array.isArray(d.hours_of_day) ? d.hours_of_day : [],
          devices: d.devices ?? {},
          pages: Array.isArray(d.pages) ? d.pages : [],
          sources: d.sources ?? {},
          recent: Array.isArray(d.recent) ? d.recent : [],
          referrers: Array.isArray(d.referrers) ? d.referrers : [],
          qr_scans: d.qr_scans ?? 0,
          qr_joined: d.qr_joined ?? 0,
        });
      });
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [supabase]);

  if (!stats) return null;

  const sources = (["qr", "invite_link", "referral", "direct"] as Source[]).map((k) => ({ k, n: stats.sources?.[k] ?? 0 }));
  const sourceMax = Math.max(0, ...sources.map((s) => s.n));
  const devices = Object.entries(stats.devices ?? {}).sort((a, b) => b[1] - a[1]);
  const deviceMax = Math.max(0, ...devices.map(([, n]) => n));
  const pageMax = Math.max(0, ...stats.pages.map((p) => p.views));

  return (
    <div className={cn("flex w-full flex-col items-center gap-6", className)}>
      <Rise>
        <Frame title="Site Traffic" note={stats.first_view ? `Owner only · since ${longDate(stats.first_view)}` : "Owner only"} gridClassName="grid-cols-3">
          <Cell label="Visitors" value={<CountUp value={stats.visitors} />} caption={`${fmt(stats.visitors_7d)} this week`} />
          <Cell label="Page views" value={<CountUp value={stats.views} />} caption={`${fmt(stats.sessions)} visits`} />
          <Cell
            label={<>{stats.live_now > 0 && <LiveDot />}Live now</>}
            value={<CountUp value={stats.live_now} />}
            caption="Open right now"
          />
          <Cell label="Today" value={<CountUp value={stats.visitors_today} />} caption={plural(stats.views_today, "view")} />
          <Cell label="Returning" value={<CountUp value={stats.returning} />} caption="Came back another day" />
          <Cell label="QR scans" value={<CountUp value={stats.qr_scans} />} caption={`${fmt(stats.qr_joined)} joined a game`} />

          <div className="col-span-full bg-background px-4 py-4">
            <div className="flex flex-col gap-2">
              <DeedRow label="Average visit">{duration(stats.avg_session_secs)}</DeedRow>
              <DeedRow label="Longest visit">{duration(stats.longest_session_secs)}</DeedRow>
              <DeedRow label="Hours on the site">{stats.hours}</DeedRow>
              <DeedRow label="Hours inside games">{stats.game_hours}</DeedRow>
              <DeedRow label="Pages per visit">{stats.pages_per_session}</DeedRow>
              <DeedRow label="Views while signed in">{stats.signed_in_share}%</DeedRow>
            </div>
          </div>

          {stats.days.length > 0 && <DailyChart days={stats.days} />}

          <Panel title="How they got here" aside="Per visit">
            <div className="flex flex-col gap-2.5">
              {sources.map(({ k, n }) => (
                <BarRow key={k} label={SOURCE_LABEL[k]} value={n} max={sourceMax} />
              ))}
            </div>
            {stats.referrers.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {stats.referrers.map((r) => (
                  <span key={r.host} className="rounded-full border border-foreground/15 px-2.5 py-1 text-[11px] text-muted-foreground">
                    {r.host} <span className="text-foreground">{fmt(r.views)}</span>
                  </span>
                ))}
              </div>
            )}
          </Panel>

          {stats.pages.length > 0 && (
            <Panel title="Pages" aside="Views · time">
              <div className="flex flex-col gap-2.5">
                {stats.pages.map((p) => (
                  <BarRow key={p.page} label={PAGE_LABEL[p.page] ?? p.page} value={p.views} max={pageMax} detail={duration(p.secs)} />
                ))}
              </div>
            </Panel>
          )}

          {devices.length > 0 && (
            <Panel title="Devices" aside="Unique visitors">
              <div className="flex flex-col gap-2.5">
                {devices.map(([d, n]) => (
                  <BarRow key={d} label={<span className="capitalize">{d}</span>} value={n} max={deviceMax} />
                ))}
              </div>
            </Panel>
          )}

          {stats.hours_of_day?.length === 24 && <HourChart hours={stats.hours_of_day} />}

          {stats.recent.length > 0 && <RecentVisits visits={stats.recent} />}
        </Frame>
      </Rise>
    </div>
  );
};

export default SiteTraffic;
