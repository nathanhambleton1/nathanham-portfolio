import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(cors());
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

console.log('Using Supabase URL:', SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// quick sanity check
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

function generateCode(len = 6) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // avoid similar-looking chars
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function createUniqueGameCode(attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    const code = generateCode();
    const { data, error } = await supabase
      .from('games')
      .select('id')
      .eq('code', code)
      .limit(1);
    if (error) throw error;
    if (!data || data.length === 0) return code;
  }
  throw new Error('Unable to generate unique game code');
}

// Create a new game
app.post('/games', async (req, res) => {
  try {
    const name = req.body?.name ?? null;
    const code = await createUniqueGameCode();

    const { data, error } = await supabase
      .from('games')
      .insert([{ code, name }])
      .select()
      .single();

    if (error) {
      console.error('Error inserting game:', error);
      return res.status(500).json({ error: 'Failed to create game' });
    }

    return res.status(201).json({ game: data });
  } catch (err) {
    console.error('Create game error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// Join a game by code and create a player with the provided name
app.post('/games/join', async (req, res) => {
  try {
    const { code, name } = req.body || {};
    if (!code || !name) return res.status(400).json({ error: 'code and name are required' });

    const { data: games, error: gErr } = await supabase
      .from('games')
      .select('*')
      .eq('code', code)
      .limit(1);

    if (gErr) throw gErr;
    if (!games || games.length === 0) return res.status(404).json({ error: 'Game not found' });

    const game = games[0];

    const playerInsert = {
      game_id: game.id,
      name,
      balance: game.initial_balance ?? 0,
    };

    const { data: playerData, error: pErr } = await supabase
      .from('players')
      .insert([playerInsert])
      .select()
      .single();

    if (pErr) {
      if (pErr.code === '23505' || (pErr.details && pErr.details.includes('players_game_name_key'))) {
        return res.status(409).json({ error: 'A player with that name already exists in this game' });
      }
      console.error('Error inserting player:', pErr);
      return res.status(500).json({ error: 'Failed to create player' });
    }

    // ensure host_player_id is set
    if (!game.host_player_id) {
      const { error: uErr } = await supabase
        .from('games')
        .update({ host_player_id: playerData.id })
        .eq('id', game.id);
      if (uErr) console.warn('Failed to set host_player_id:', uErr.message || uErr);
      else game.host_player_id = playerData.id;
    }

    return res.status(201).json({ game, player: playerData });
  } catch (err) {
    console.error('Join game error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// Get game by code
app.get('/games/:code', async (req, res) => {
  try {
    const code = req.params.code;
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('code', code)
      .limit(1);
    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ error: 'Game not found' });
    return res.json({ game: data[0] });
  } catch (err) {
    console.error('Get game error:', err);
    return res.status(500).json({ error: 'Failed to fetch game' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
