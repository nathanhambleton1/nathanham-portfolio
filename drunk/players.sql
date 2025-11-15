create table public.players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  name text not null,
  balance int4 not null default 0,
  pending_sips int4 not null default 0,
  is_commissioner boolean not null default false,
  is_online boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Each game cannot have duplicate names
create unique index players_game_name_key
  on public.players (game_id, name);
  
create index players_game_id_idx on public.players (game_id);
