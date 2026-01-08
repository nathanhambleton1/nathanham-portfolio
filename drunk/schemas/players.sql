create table public.players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  name text not null,
  balance int4 not null default 0,
  pending_sips int4 not null default 0,
  total_sips int4 not null default 0,
  is_commissioner boolean not null default false,
  is_online boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Messenger columns
-- has_new_messenger: boolean to indicate new messenger
-- messenger_data: text to hold message data
ALTER TABLE public.players
ADD COLUMN has_new_messenger BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN messenger_data TEXT;

-- Bankruptcy columns
-- is_bankrupt: boolean to indicate if player is in ghost mode
-- bankrupt_at: timestamp when bankruptcy was declared
ALTER TABLE public.players
ADD COLUMN is_bankrupt BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN bankrupt_at TIMESTAMPTZ;

-- Each game cannot have duplicate names
create unique index players_game_name_key
  on public.players (game_id, name);
  
create index players_game_id_idx on public.players (game_id);
