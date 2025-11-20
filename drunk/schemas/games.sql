create table public.games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,        -- short join code (e.g., 6 chars)
  name text,                        -- optional game name
  status text not null default 'active',  -- 'lobby' | 'active' | 'finished'
  host_player_id uuid,              -- FK to players.id once first player joins
  free_parking_balance int4 not null default 0,
  initial_balance int4 not null default 1500,  -- starting money
  pass_go_amount int4 not null default 200,
  -- Trade/timer features: default 60 seconds (1 minute). When a trade timer is
  -- started, `trade_locked` should be set to true and `trade_timer_expires_at`
  -- should contain the timestamp when the timer will expire.
  trade_timer_seconds int4 not null default 60,
  trade_timer_expires_at timestamptz,
  trade_locked boolean not null default false,
  trade_started_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index games_code_idx on public.games (code);
create index games_trade_expires_idx on public.games (trade_timer_expires_at);
