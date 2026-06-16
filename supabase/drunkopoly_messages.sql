-- Drunkopoly messaging (direct chats + message log)
-- Note: This project uses Supabase (Postgres + Realtime). Apply these migrations in Supabase.

-- Chats
CREATE TABLE IF NOT EXISTS public.drunkopoly_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  title text NULL,
  created_by_player_id uuid NULL REFERENCES public.players(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Chat members (tracks read state per player)
CREATE TABLE IF NOT EXISTS public.drunkopoly_chat_members (
  chat_id uuid NOT NULL REFERENCES public.drunkopoly_chats(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NULL,
  PRIMARY KEY (chat_id, player_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS public.drunkopoly_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.drunkopoly_chats(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  sender_player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  body text NOT NULL,
  kind text NULL DEFAULT 'chat', -- 'chat' | 'payment' | etc.
  meta jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drunkopoly_chat_members_player_id_idx
  ON public.drunkopoly_chat_members (player_id);

CREATE INDEX IF NOT EXISTS drunkopoly_chat_messages_chat_id_created_at_idx
  ON public.drunkopoly_chat_messages (chat_id, created_at);

CREATE INDEX IF NOT EXISTS drunkopoly_chat_messages_game_id_created_at_idx
  ON public.drunkopoly_chat_messages (game_id, created_at);

-- Optional (if using Supabase Realtime):
-- alter publication supabase_realtime add table public.drunkopoly_chats;
-- alter publication supabase_realtime add table public.drunkopoly_chat_members;
-- alter publication supabase_realtime add table public.drunkopoly_chat_messages;

