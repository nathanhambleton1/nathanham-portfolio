-- device_status table: single row per device, server-managed last_seen timestamp
create table public.device_status (
  device_id text not null,
  last_seen timestamp with time zone null default now(),
  info jsonb null,
  constraint device_status_pkey primary key (device_id)
) TABLESPACE pg_default;

-- Trigger to update last_seen to now() on insert or update
create or replace function public.device_status_set_last_seen()
returns trigger as $$
begin
  new.last_seen = now();
  return new;
end;
$$ language plpgsql;

create trigger device_status_set_last_seen_trigger
before insert or update on public.device_status
for each row execute function public.device_status_set_last_seen();
