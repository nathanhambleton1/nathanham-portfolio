-- Property ownership table for Drunkopoly
create table public.property_ownership (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  player_id uuid references public.players (id) on delete cascade,
  property_id text not null, -- references MONOPOLY_PROPERTIES.id from client-side data
  houses int4 not null default 0, -- 0-4 houses, 5 = hotel
  is_mortgaged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index property_ownership_game_id_idx on public.property_ownership (game_id);
create index property_ownership_player_id_idx on public.property_ownership (player_id);

-- Unique constraint: each property can only exist once per game
create unique index property_ownership_game_property_key on public.property_ownership (game_id, property_id);

-- Enable Row Level Security
alter table public.property_ownership enable row level security;

-- Allow anyone to read property ownership for their game
create policy "Allow read for game participants"
  on public.property_ownership for select
  using (true);

-- Allow anyone to insert/update/delete property ownership
create policy "Allow all operations"
  on public.property_ownership for all
  using (true);
