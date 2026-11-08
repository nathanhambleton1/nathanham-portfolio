-- Drunkopoly site analytics: page views + time on page, shown in the lobby's
-- "Site Traffic" panel. The table is locked behind RLS with no policies; the
-- browser can only write through the two security-definer RPCs below and only
-- read the aggregate from drunkopoly_site_stats().
--
-- Only @nathan_ham can read the stats: drunkopoly_site_stats() checks the
-- caller's Supabase session against drunk_users and returns null otherwise.
--
-- One row = one view of one screen ('lobby', 'game', 'rules', 'messages',
-- 'player'). `seconds` is time the tab was actually visible on that screen,
-- topped up by heartbeat pings from drunk/lib/drunkAnalytics.ts.

create table if not exists public.drunkopoly_page_views (
  id uuid primary key,
  visitor_id text not null,          -- random id kept in the browser's localStorage
  session_id text not null,          -- random id per browser tab session
  page text not null,
  referrer text,                     -- external referring host, first view of a session only
  device text not null default 'desktop',
  signed_in boolean not null default false,
  username text,                     -- drunk_users.username, from the caller's session (never trusted from the client)
  player_name text,                  -- name typed when joining a game, attached to the whole tab session
  source text not null default 'direct', -- how the tab session arrived: qr | invite_link | referral | direct
  game_code text,                    -- game code from a QR / invite link
  seconds integer not null default 0,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

-- Columns added after the first version (keeps this file safe to re-run).
alter table public.drunkopoly_page_views
  add column if not exists username text,
  add column if not exists player_name text,
  add column if not exists source text not null default 'direct',
  add column if not exists game_code text;
drop function if exists public.drunkopoly_track_view(uuid, text, text, text, text, text, boolean);

create index if not exists drunkopoly_page_views_created_idx on public.drunkopoly_page_views (created_at);
create index if not exists drunkopoly_page_views_visitor_idx on public.drunkopoly_page_views (visitor_id);

alter table public.drunkopoly_page_views enable row level security;
revoke all on public.drunkopoly_page_views from anon, authenticated;

create or replace function public.drunkopoly_track_view(
  p_id uuid, p_visitor text, p_session text, p_page text,
  p_referrer text, p_device text, p_source text, p_game_code text, p_player_name text
) returns void
language sql
security definer
set search_path = public
as $$
  insert into drunkopoly_page_views
    (id, visitor_id, session_id, page, referrer, device, signed_in, username, source, game_code, player_name)
  select
    p_id,
    left(p_visitor, 64),
    left(p_session, 64),
    case when p_page in ('lobby', 'game', 'rules', 'messages', 'player') then p_page else 'other' end,
    nullif(left(p_referrer, 120), ''),
    case when p_device in ('mobile', 'tablet', 'desktop') then p_device else 'desktop' end,
    u.username is not null,
    u.username,
    case when p_source in ('qr', 'invite_link', 'referral', 'direct') then p_source else 'direct' end,
    nullif(upper(left(p_game_code, 12)), ''),
    nullif(left(trim(p_player_name), 40), '')
  from (select (select username from drunk_users where auth_user_id = auth.uid() limit 1) as username) u
  on conflict (id) do nothing;
$$;

-- Tag every view in a tab session with the player name they joined a game as.
create or replace function public.drunkopoly_track_player(p_session text, p_player_name text, p_game_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update drunkopoly_page_views
     set player_name = nullif(left(trim(p_player_name), 40), ''),
         game_code = coalesce(game_code, nullif(upper(left(p_game_code, 12)), ''))
   where session_id = left(p_session, 64)
     and created_at > now() - interval '12 hours';
$$;

create or replace function public.drunkopoly_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from drunk_users where auth_user_id = auth.uid() and lower(username) = 'nathan_ham');
$$;

-- Seconds only ever grow, and one view is capped at 8 hours.
create or replace function public.drunkopoly_track_ping(p_id uuid, p_seconds integer)
returns void
language sql
security definer
set search_path = public
as $$
  update drunkopoly_page_views
     set seconds = greatest(seconds, least(greatest(p_seconds, 0), 8 * 3600)),
         last_seen = now()
   where id = p_id
     and created_at > now() - interval '12 hours';
$$;

create or replace function public.drunkopoly_site_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
with v as (
  select *, (created_at at time zone 'America/New_York') as local_at
  from drunkopoly_page_views
),
sessions as (
  select session_id, min(created_at) as started, sum(seconds) as secs, count(*) as views
  from v group by session_id
),
visitor_days as (
  select visitor_id, count(distinct local_at::date) as days from v group by visitor_id
),
today as (select (now() at time zone 'America/New_York')::date as d),
-- One row per tab session: who, how they arrived, how long they stayed.
visits as (
  select session_id,
         min(created_at) as started,
         max(last_seen) as last_seen,
         sum(seconds) as secs,
         count(*) as views,
         (array_agg(source order by created_at))[1] as source,
         max(game_code) as game_code,
         max(username) as username,
         max(player_name) as player_name,
         (array_agg(device order by created_at))[1] as device,
         (array_agg(referrer order by created_at))[1] as referrer,
         bool_or(page = 'game') as played
  from v group by session_id
)
select json_build_object(
  'first_view', (select min(created_at) from v),
  'views', (select count(*) from v),
  'visitors', (select count(distinct visitor_id) from v),
  'sessions', (select count(*) from sessions),
  'returning', (select count(*) from visitor_days where days > 1),
  'live_now', (select count(distinct session_id) from v where last_seen > now() - interval '2 minutes'),
  'views_today', (select count(*) from v, today where local_at::date = today.d),
  'visitors_today', (select count(distinct visitor_id) from v, today where local_at::date = today.d),
  'visitors_7d', (select count(distinct visitor_id) from v where created_at > now() - interval '7 days'),
  'hours', (select round(coalesce(sum(seconds), 0) / 3600.0, 1) from v),
  'game_hours', (select round(coalesce(sum(seconds), 0) / 3600.0, 1) from v where page = 'game'),
  'avg_session_secs', (select coalesce(round(avg(secs)), 0) from sessions where secs > 0),
  'longest_session_secs', (select coalesce(max(secs), 0) from sessions),
  'pages_per_session', (select coalesce(round(avg(views), 1), 0) from sessions),
  'signed_in_share', (select coalesce(round(100.0 * count(*) filter (where signed_in) / nullif(count(*), 0)), 0) from v),
  'days', (
    select json_agg(json_build_object('day', d.day, 'views', coalesce(c.views, 0), 'visitors', coalesce(c.visitors, 0)) order by d.day)
    from (select generate_series(today.d - 29, today.d, interval '1 day')::date as day from today) d
    left join (
      select local_at::date as day, count(*) as views, count(distinct visitor_id) as visitors
      from v group by 1
    ) c on c.day = d.day
  ),
  'hours_of_day', (
    select json_agg(coalesce(c.n, 0) order by h.hr)
    from generate_series(0, 23) as h(hr)
    left join (select extract(hour from local_at)::int as hr, count(*) as n from v group by 1) c on c.hr = h.hr
  ),
  'devices', (
    select coalesce(json_object_agg(device, n), '{}'::json)
    from (select device, count(distinct visitor_id) as n from v group by device) d
  ),
  'pages', (
    select coalesce(json_agg(json_build_object('page', page, 'views', views, 'secs', secs) order by views desc), '[]'::json)
    from (select page, count(*) as views, sum(seconds) as secs from v group by page) p
  ),
  'sources', (
    select coalesce(json_object_agg(source, n), '{}'::json)
    from (select source, count(*) as n from visits group by source) s
  ),
  'qr_scans', (select count(*) from visits where source = 'qr'),
  'qr_joined', (select count(*) from visits where source = 'qr' and played),
  'recent', (
    select coalesce(json_agg(row_to_json(r) order by r.started desc), '[]'::json)
    from (
      select started, last_seen, secs, views, source, game_code, username, player_name, device, referrer, played
      from visits order by started desc limit 30
    ) r
  ),
  'referrers', (
    select coalesce(json_agg(json_build_object('host', referrer, 'views', n) order by n desc), '[]'::json)
    from (select referrer, count(*) as n from v where referrer is not null group by referrer order by n desc limit 5) r
  )
)
where drunkopoly_is_admin();
$$;

grant execute on function public.drunkopoly_track_view(uuid, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.drunkopoly_track_player(text, text, text) to anon, authenticated;
grant execute on function public.drunkopoly_is_admin() to anon, authenticated;
grant execute on function public.drunkopoly_track_ping(uuid, integer) to anon, authenticated;
grant execute on function public.drunkopoly_site_stats() to anon, authenticated;
