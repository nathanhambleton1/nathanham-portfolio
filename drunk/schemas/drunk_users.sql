create table public.drunk_users (
  id uuid not null default gen_random_uuid (),
  username text not null,
  password text not null,
  first_name text null,
  last_name text null,
  avatar_url text null,
  bio text null,
  wins integer null default 0,
  losses integer null default 0,
  created_at timestamp with time zone null default now(),
  constraint drunk_users_pkey primary key (id),
  constraint drunk_users_username_key unique (username)
) TABLESPACE pg_default;