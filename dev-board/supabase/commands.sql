create table public.commands (
  id bigint generated always as identity not null,
  created_at timestamp with time zone null default now(),
  cmd text not null,
  payload jsonb null,
  status text null default 'pending'::text,
  constraint commands_pkey primary key (id)
) TABLESPACE pg_default;