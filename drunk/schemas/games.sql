create table public.games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,        -- short join code (e.g., 6 chars)
  name text,                        -- optional game name
  status text not null default 'active',  -- 'lobby' | 'active' | 'finished'
  host_player_id uuid,              -- FK to players.id once first player joins
  free_parking_balance int4 not null default 0,
  initial_balance int4 not null default 1500,  -- starting money
  pass_go_amount int4 not null default 200,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index games_code_idx on public.games (code);
