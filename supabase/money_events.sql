create table public.money_events (
  id uuid not null default gen_random_uuid (),
  game_id uuid not null,
  actor_player_id uuid null,
  from_player_id uuid null,
  to_player_id uuid null,
  amount integer not null,
  type text not null,
  description text null,
  created_at timestamp with time zone not null default now(),
  constraint money_events_pkey primary key (id),
  constraint money_events_actor_player_id_fkey foreign KEY (actor_player_id) references players (id),
  constraint money_events_from_player_id_fkey foreign KEY (from_player_id) references players (id),
  constraint money_events_game_id_fkey foreign KEY (game_id) references games (id) on delete CASCADE,
  constraint money_events_to_player_id_fkey foreign KEY (to_player_id) references players (id)
) TABLESPACE pg_default;

create index IF not exists money_events_game_id_idx on public.money_events using btree (game_id) TABLESPACE pg_default;

create index IF not exists money_events_game_created_idx on public.money_events using btree (game_id, created_at desc) TABLESPACE pg_default;