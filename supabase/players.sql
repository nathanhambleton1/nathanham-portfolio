create table public.players (
  id uuid not null default gen_random_uuid (),
  game_id uuid not null,
  name text not null,
  balance integer not null default 0,
  pending_sips integer not null default 0,
  is_commissioner boolean not null default false,
  is_online boolean not null default true,
  last_seen_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  total_sips integer not null default 0,
  in_jail boolean null default false,
  jail_started_by uuid null,
  jail_started_at timestamp with time zone null,
  has_get_out_of_jail_card boolean null default false,
  has_new_messenger boolean not null default false,
  messenger_data text null,
  is_bankrupt boolean not null default false,
  bankrupt_at timestamp with time zone null,
  avatar_url text null,
  user_id uuid null,
  constraint players_pkey primary key (id),
  constraint players_game_id_fkey foreign KEY (game_id) references games (id) on delete CASCADE,
  constraint players_user_id_fkey foreign KEY (user_id) references drunk_users (id) on delete set null
) TABLESPACE pg_default;

create unique INDEX IF not exists players_game_name_key on public.players using btree (game_id, name) TABLESPACE pg_default;

create index IF not exists players_game_id_idx on public.players using btree (game_id) TABLESPACE pg_default;