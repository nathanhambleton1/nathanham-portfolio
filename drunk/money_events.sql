create table public.money_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  actor_player_id uuid references public.players (id), -- who initiated
  from_player_id uuid references public.players (id),  -- nullable for bank
  to_player_id uuid references public.players (id),    -- nullable for bank
  amount int4 not null,                                -- positive
  type text not null,                                  -- 'rent', 'go', 'tax', 'free_parking_add', 'free_parking_collect', 'mortgage', 'house', 'hotel', 'jail', 'chance', 'community_chest', 'manual', etc.
  description text,
  created_at timestamptz not null default now()
);

create index money_events_game_id_idx on public.money_events (game_id);
create index money_events_game_created_idx on public.money_events (game_id, created_at desc);
