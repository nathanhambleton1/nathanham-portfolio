create table public.sip_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  from_player_id uuid references public.players (id),  -- usually commissioner
  to_player_id uuid not null references public.players (id),
  sip_count int4 not null,                             -- can be >1
  status text not null default 'pending',              -- 'pending' | 'acknowledged' | 'cleared'
  created_at timestamptz not null default now(),
  cleared_at timestamptz
);

create index sip_events_game_id_idx on public.sip_events (game_id);
create index sip_events_game_created_idx on public.sip_events (game_id, created_at desc);
