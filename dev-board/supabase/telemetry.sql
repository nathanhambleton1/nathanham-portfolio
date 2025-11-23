create table public.telemetry (
  id bigint generated always as identity not null,
  created_at timestamp with time zone null default now(),
  type text not null,
  payload jsonb null,
  constraint telemetry_pkey primary key (id)
) TABLESPACE pg_default;