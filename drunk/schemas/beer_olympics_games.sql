-- Beer Olympics Games Table
create table public.beer_olympics_games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,        -- short join code (e.g., 6 chars)
  name text,                         -- optional game name
  status text not null default 'setup',  -- 'setup' | 'in_progress' | 'finished'
  host_player_id uuid,               -- FK to beer_olympics_players.id once first player joins
  current_event_index int4 not null default 0,  -- tracks which event we're on
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index beer_olympics_games_code_idx on public.beer_olympics_games (code);

-- Beer Olympics Players Table
create table public.beer_olympics_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.beer_olympics_games (id) on delete cascade,
  name text not null,
  total_points int4 not null default 0,
  is_commissioner boolean not null default false,
  is_online boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Each game cannot have duplicate names
create unique index beer_olympics_players_game_name_key
  on public.beer_olympics_players (game_id, name);
  
create index beer_olympics_players_game_id_idx on public.beer_olympics_players (game_id);

-- Beer Olympics Events Table (configured events for a game)
create table public.beer_olympics_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.beer_olympics_games (id) on delete cascade,
  event_type text not null,  -- 'shotgun_time' | 'funnel_time' | 'stack_cup' | 'pong' | 'beer_ball' | '40_yard_dash' | 'flip_cup' | 'custom'
  event_name text not null,
  event_order int4 not null,  -- order in which events are played
  point_mode text not null default 'ranking',  -- 'ranking' | 'custom' | 'win_loss'
  first_place_points int4,    -- for ranking mode
  second_place_points int4,
  third_place_points int4,
  fourth_place_points int4,
  fifth_place_points int4,
  win_points int4,            -- for win_loss mode
  loss_points int4,
  is_team_event boolean not null default false,
  is_timed boolean not null default false,  -- whether this uses the timer feature
  status text not null default 'pending',  -- 'pending' | 'active' | 'completed'
  created_at timestamptz not null default now()
);

create index beer_olympics_events_game_id_idx on public.beer_olympics_events (game_id);
create index beer_olympics_events_order_idx on public.beer_olympics_events (game_id, event_order);

-- Beer Olympics Scores Table (individual results per event per player)
create table public.beer_olympics_scores (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.beer_olympics_events (id) on delete cascade,
  player_id uuid not null references public.beer_olympics_players (id) on delete cascade,
  points int4 not null default 0,
  ranking int4,               -- 1st, 2nd, 3rd etc.
  time_seconds decimal(10,3), -- for timed events (with milliseconds)
  team_id text,               -- for team events (beer ball, pong)
  notes text,                 -- custom notes
  created_at timestamptz not null default now()
);

create index beer_olympics_scores_event_id_idx on public.beer_olympics_scores (event_id);
create index beer_olympics_scores_player_id_idx on public.beer_olympics_scores (player_id);

-- Beer Olympics Timer Submissions Table (for multi-user timer averaging)
create table public.beer_olympics_timers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.beer_olympics_events (id) on delete cascade,
  player_id uuid not null references public.beer_olympics_players (id) on delete cascade,
  subject_player_id uuid not null references public.beer_olympics_players (id) on delete cascade,  -- whose time is being recorded
  time_seconds decimal(10,3) not null,  -- submitted time in seconds
  created_at timestamptz not null default now()
);

create index beer_olympics_timers_event_id_idx on public.beer_olympics_timers (event_id);
create index beer_olympics_timers_subject_idx on public.beer_olympics_timers (event_id, subject_player_id);

-- Beer Olympics Activity Log View
create view public.beer_olympics_activity as
  select
    s.id,
    s.event_id,
    e.game_id,
    s.player_id,
    p.name as player_name,
    e.event_name,
    s.points,
    s.ranking,
    s.time_seconds,
    s.notes,
    s.created_at
  from public.beer_olympics_scores s
  join public.beer_olympics_events e on s.event_id = e.id
  join public.beer_olympics_players p on s.player_id = p.id
  order by s.created_at desc;
