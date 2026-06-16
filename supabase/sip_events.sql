create table public.sip_events (
  id uuid not null default gen_random_uuid (),
  game_id uuid not null,
  from_player_id uuid null,
  to_player_id uuid not null,
  sip_count integer not null,
  status text not null default 'pending'::text,
  created_at timestamp with time zone not null default now(),
  cleared_at timestamp with time zone null,
  constraint sip_events_pkey primary key (id),
  constraint sip_events_from_player_id_fkey foreign KEY (from_player_id) references players (id),
  constraint sip_events_game_id_fkey foreign KEY (game_id) references games (id) on delete CASCADE,
  constraint sip_events_to_player_id_fkey foreign KEY (to_player_id) references players (id)
) TABLESPACE pg_default;

create index IF not exists sip_events_game_id_idx on public.sip_events using btree (game_id) TABLESPACE pg_default;

create index IF not exists sip_events_game_created_idx on public.sip_events using btree (game_id, created_at desc) TABLESPACE pg_default;