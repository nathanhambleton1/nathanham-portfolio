import { createClient } from "@supabase/supabase-js";

// Drunkopoly's Supabase client. Player accounts are real Supabase Auth users,
// so this client keeps its session under its own storage key — separate from
// the site owner's session (src/lib/supabase.ts) so signing into a game never
// signs anyone into, or out of, the owner tools.
export const SUPABASE_URL = "https://kcyrvubzhsphpxfsewii.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjeXJ2dWJ6aHNwaHB4ZnNld2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxODAwMTcsImV4cCI6MjA3ODc1NjAxN30.8psClrpif-F1DWj67u2tErnU8-4ZYjw5LvEfRK3oHkI";

export const drunkSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storageKey: "drunkopoly-auth",
    persistSession: true,
    autoRefreshToken: true,
    // Sessions come from the drunk-auth edge function, never from a link.
    detectSessionInUrl: false,
  },
});

export default drunkSupabase;
