-- Run this in the Supabase SQL editor.

-- 1. Add avatar_url to user accounts
ALTER TABLE public.drunk_users ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Add avatar_url to players (populated when a user joins)
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS avatar_url text;

-- 3. Create an avatars storage bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Allow anon/authenticated to upload avatars
DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
CREATE POLICY "avatars_insert"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'avatars');

-- 5. Allow anon/authenticated to update avatars (re-upload)
DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
CREATE POLICY "avatars_update"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'avatars');

-- 6. Allow public read of avatars
DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
CREATE POLICY "avatars_select"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'avatars');
