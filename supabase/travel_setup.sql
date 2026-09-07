-- =============================================================================
-- Travel / Shot Glass Journey — Supabase setup
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- NOTE on security: editing is gated by a real Supabase Auth session (see
-- src/travel/context/EditMode.tsx), and the policies below enforce that at
-- the database level: anyone can read, but only an `authenticated` session
-- can write. Two one-time manual steps in the Supabase dashboard make this
-- actually secure:
--   1. Authentication → Providers → Email → turn OFF "Allow new users to
--      sign up". Only a manually-created account should ever exist.
--   2. Authentication → Users → Add user → create the single owner account
--      (nhambleton03@gmail.com) with a chosen password, and mark its
--      email confirmed (auto-confirm is on by default for dashboard-created
--      users). That password is what unlocks editing on the site.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.travel_trips (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  start_date  date,
  end_date    date,
  cover_url   text,
  color       text,                 -- accent hex for the trip, e.g. '#e9a23b'
  sort_order  int  default 0,
  created_at  timestamptz default now()
);

create table if not exists public.travel_glasses (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid references public.travel_trips(id) on delete set null,
  location_name text not null,      -- "Trevi Fountain"
  place_detail  text,               -- "Rome, Italy"
  latitude      double precision,
  longitude     double precision,
  collected_at  timestamptz,        -- date + time collected
  story         text,               -- the memory / write-up
  glass_url     text,               -- photo of the shot glass itself
  sort_order    int  default 0,
  created_at    timestamptz default now()
);

create table if not exists public.travel_photos (
  id         uuid primary key default gen_random_uuid(),
  glass_id   uuid references public.travel_glasses(id) on delete cascade,
  url        text not null,
  caption    text,
  sort_order int  default 0,
  created_at timestamptz default now()
);

create index if not exists travel_glasses_trip_id_idx on public.travel_glasses(trip_id);
create index if not exists travel_photos_glass_id_idx  on public.travel_photos(glass_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — public read, authenticated-only write (see note above)
-- ---------------------------------------------------------------------------

alter table public.travel_trips   enable row level security;
alter table public.travel_glasses enable row level security;
alter table public.travel_photos  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['travel_trips','travel_glasses','travel_photos'] loop
    -- Drop the old cosmetic-password-era policy, if present.
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);

    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_read', t
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_write', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Storage — public bucket "travel-photos"
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('travel-photos', 'travel-photos', true)
on conflict (id) do update set public = true;

-- Anyone can read; only an authenticated session can upload / update / delete.
drop policy if exists "travel_photos_read"   on storage.objects;
drop policy if exists "travel_photos_write"  on storage.objects;
drop policy if exists "travel_photos_update" on storage.objects;
drop policy if exists "travel_photos_delete" on storage.objects;

create policy "travel_photos_read"   on storage.objects for select
  using (bucket_id = 'travel-photos');
create policy "travel_photos_write"  on storage.objects for insert to authenticated
  with check (bucket_id = 'travel-photos');
create policy "travel_photos_update" on storage.objects for update to authenticated
  using (bucket_id = 'travel-photos');
create policy "travel_photos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'travel-photos');
