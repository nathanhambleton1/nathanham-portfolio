-- Player statistics table for advanced win probability calculations
-- Tracks gameplay events and patterns for each player in a game
create table public.player_statistics (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  
  -- Movement tracking
  times_passed_go int4 not null default 0,
  times_went_to_jail int4 not null default 0,
  times_landed_free_parking int4 not null default 0,
  
  -- Detailed money received tracking
  money_received_from_go int4 not null default 0,
  money_received_from_free_parking int4 not null default 0,
  money_received_from_players int4 not null default 0,
  money_received_from_bank int4 not null default 0,
  total_money_received int4 not null default 0,
  
  -- Detailed money spent tracking
  money_paid_to_bank int4 not null default 0,
  money_paid_to_players int4 not null default 0,
  money_paid_for_jail int4 not null default 0,
  total_money_spent int4 not null default 0,
  
  -- Legacy fields (kept for backward compatibility)
  total_tax_paid int4 not null default 0,
  total_rent_paid int4 not null default 0,
  total_rent_received int4 not null default 0,
  
  -- Property interaction tracking
  times_others_landed_on_properties int4 not null default 0, -- how "hot" their properties are
  
  -- Luck/streak tracking (derived from patterns)
  current_luck_score numeric not null default 0, -- -1.0 to 1.0, calculated based on recent events
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create unique index player_statistics_game_player_key on public.player_statistics (game_id, player_id);
create index player_statistics_game_id_idx on public.player_statistics (game_id);
create index player_statistics_player_id_idx on public.player_statistics (player_id);

-- Enable Row Level Security
alter table public.player_statistics enable row level security;

-- Allow anyone to read/write statistics
create policy "Allow all operations on player_statistics"
  on public.player_statistics for all
  using (true);

-- Property landing tracking - tracks which properties are "hot" in this game
create table public.property_landing_stats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  property_id text not null, -- references MONOPOLY_PROPERTIES.id
  times_landed int4 not null default 0,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create unique index property_landing_stats_game_property_key on public.property_landing_stats (game_id, property_id);
create index property_landing_stats_game_id_idx on public.property_landing_stats (game_id);

-- Enable Row Level Security
alter table public.property_landing_stats enable row level security;

-- Allow anyone to read/write landing stats
create policy "Allow all operations on property_landing_stats"
  on public.property_landing_stats for all
  using (true);
