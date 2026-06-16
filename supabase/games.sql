create table public.games (
  id uuid not null default gen_random_uuid (),
  code text not null,
  name text null,
  status text not null default 'active'::text,
  host_player_id uuid null,
  free_parking_balance integer not null default 0,
  initial_balance integer not null default 1500,
  pass_go_amount integer not null default 200,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  trade_timer_seconds integer not null default 60,
  trade_timer_expires_at timestamp with time zone null,
  trade_locked boolean not null default false,
  trade_started_by uuid null,
  show_balances boolean not null default true,
  sips_enabled boolean not null default true,
  expansion_enabled boolean not null default false,
  gambling_enabled boolean null default false,
  constraint games_pkey primary key (id),
  constraint games_code_key unique (code)
) TABLESPACE pg_default;

create index IF not exists games_code_idx on public.games using btree (code) TABLESPACE pg_default;

create index IF not exists games_trade_expires_idx on public.games using btree (trade_timer_expires_at) TABLESPACE pg_default;