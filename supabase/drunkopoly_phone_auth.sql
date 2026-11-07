-- Drunkopoly accounts: just a phone number (no password, no email, no texts).
--
-- * drunk_users stays the profile table (players.user_id still points at it),
--   so existing stats, wins and photos carry over untouched.
-- * Each profile is linked to an auth.users row (auth_user_id) with a
--   placeholder email and no password. The `drunk-auth` edge function signs a
--   player in by minting a session for whoever owns the entered number.
-- * The phone number (E.164, e.g. +15551234567) is the login handle. It is
--   never readable through the public API — only via drunk_my_profile().
-- * Old accounts (no auth_user_id) are moved over during sign-up when the
--   player confirms the matching username is theirs.
-- * drunk_verify_legacy below is from the first (password) version and is no
--   longer called; it is service-role only and safe to drop.

alter table public.drunk_users
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null,
  add column if not exists phone text unique,
  alter column password drop not null;

alter table public.drunk_users
  drop constraint if exists drunk_users_phone_format;
alter table public.drunk_users
  add constraint drunk_users_phone_format check (phone is null or phone ~ '^\+1[2-9][0-9]{9}$');

-- Usernames are unique regardless of case ("Snake" == "snake").
create unique index if not exists drunk_users_username_lower_key on public.drunk_users (lower(username));

-- ---------------------------------------------------------------------------
-- Column-level access: the public API can read profile fields but never the
-- phone number, password hash or auth link. Writes are limited to the fields
-- the game updates (stats, name, photo). Phone/username go through RPCs.
-- ---------------------------------------------------------------------------
revoke all on public.drunk_users from anon, authenticated;
grant select (id, username, first_name, last_name, avatar_url, bio, wins, losses, total_sips, created_at)
  on public.drunk_users to anon, authenticated;
grant update (first_name, last_name, avatar_url, bio, wins, losses, total_sips)
  on public.drunk_users to anon, authenticated;

-- The signed-in user's own profile, including their phone number.
create or replace function public.drunk_my_profile()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select (to_jsonb(u) - 'password' - 'auth_user_id')::json
  from public.drunk_users u
  where u.auth_user_id = auth.uid()
  limit 1;
$$;

-- Change the signed-in user's phone number.
create or replace function public.drunk_update_phone(p_phone text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  u public.drunk_users;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if p_phone is null or p_phone !~ '^\+1[2-9][0-9]{9}$' then
    raise exception 'Enter a valid 10-digit US phone number' using errcode = '22023';
  end if;
  update public.drunk_users set phone = p_phone
  where auth_user_id = auth.uid()
  returning * into u;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  return (to_jsonb(u) - 'password' - 'auth_user_id')::json;
exception when unique_violation then
  raise exception 'That phone number is already linked to another account' using errcode = '23505';
end $$;

-- Change the signed-in user's username.
create or replace function public.drunk_update_username(p_username text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  u public.drunk_users;
  v text := btrim(coalesce(p_username, ''));
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if v !~ '^[A-Za-z0-9_.]{3,20}$' then
    raise exception 'Usernames are 3-20 letters, numbers, _ or .' using errcode = '22023';
  end if;
  update public.drunk_users set username = v
  where auth_user_id = auth.uid()
  returning * into u;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  return (to_jsonb(u) - 'password' - 'auth_user_id')::json;
exception when unique_violation then
  raise exception 'That username is taken' using errcode = '23505';
end $$;

-- Verify an old (pre-phone) account's password so it can be claimed.
-- Service role only: called by the drunk-auth edge function.
create or replace function public.drunk_verify_legacy(p_username text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  u public.drunk_users;
begin
  select * into u from public.drunk_users
  where lower(username) = lower(btrim(p_username)) and auth_user_id is null;
  if not found or u.password is null then
    return null;
  end if;
  if u.password like '$2%' then
    if extensions.crypt(p_password, u.password) <> u.password then
      return null;
    end if;
  elsif u.password <> p_password then
    return null;
  end if;
  return u.id;
end $$;

revoke all on function public.drunk_my_profile() from public;
revoke all on function public.drunk_update_phone(text) from public;
revoke all on function public.drunk_update_username(text) from public;
revoke all on function public.drunk_verify_legacy(text, text) from public, anon, authenticated;
grant execute on function public.drunk_my_profile() to authenticated;
grant execute on function public.drunk_update_phone(text) to authenticated;
grant execute on function public.drunk_update_username(text) to authenticated;
grant execute on function public.drunk_verify_legacy(text, text) to service_role;

-- The old username/password RPCs are replaced by the drunk-auth edge function.
-- Run these once the new client is deployed (the live site still calls them):
-- drop function if exists public.drunk_sign_in(text, text);
-- drop function if exists public.drunk_sign_up(text, text, text, text, text);
