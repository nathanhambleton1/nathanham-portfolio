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
  -- Balance visibility: when true, players can see other players' balances.
  -- When false, only your own balance is visible (in pay popup, settings, etc.)
  show_balances boolean not null default true,
  -- Sips gameplay: when true, the Drunkopoly sips features (assigning/completing sips)
  -- are enabled. When false, hide sip counters and related UI on the client.
  sips_enabled boolean not null default true,
  -- Expansion Pack: when true, payments to the bank are routed to Free Parking pot
  expansion_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migration: Add show_balances column to existing games table
-- ALTER TABLE public.games ADD COLUMN IF NOT EXISTS show_balances boolean NOT NULL DEFAULT true;
-- Migration: Add sips_enabled column to existing games table
-- ALTER TABLE public.games ADD COLUMN IF NOT EXISTS sips_enabled boolean NOT NULL DEFAULT true;
-- Migration: Add expansion_enabled column to existing games table
-- ALTER TABLE public.games ADD COLUMN IF NOT EXISTS expansion_enabled boolean NOT NULL DEFAULT false;

create index games_code_idx on public.games (code);
create index games_trade_expires_idx on public.games (trade_timer_expires_at);
