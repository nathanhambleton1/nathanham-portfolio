-- Create a simple users table for the Drunkopoly game
-- Run this in your Supabase SQL editor

create table if not exists public.drunk_users (
  id uuid default gen_random_uuid() primary key,
  username text not null unique,
  password text not null,
  first_name text,
  last_name text,
  avatar_url text,
  bio text,
  wins int default 0,
  losses int default 0,
  created_at timestamptz default now()
);

-- Example: grant basic select/insert/update to anon role if desired (use with caution)
-- grant insert, select, update on public.drunk_users to anon;

-- Example seed (optional):
-- insert into public.drunk_users (username, password, first_name) values ('demo','demo123','Demo');
