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


    // Check if this is the first player in the game
    const { data: existingPlayersCount, error: countErr } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', game.id);
    if (countErr) throw countErr;
    const isFirstPlayer = (existingPlayersCount && typeof existingPlayersCount.count === 'number')
      ? existingPlayersCount.count === 0
      : true;

    const playerInsert = {
      game_id: game.id,
      name,
      balance: game.initial_balance ?? 0,
      is_commissioner: isFirstPlayer,
    };

    const { data: playerData, error: pErr } = await supabase
      .from('players')
      .insert([playerInsert])
      .select()
      .single();

    if (pErr) {
      // If the insert failed due to unique name constraint, treat this as a rejoin:
      // fetch the existing player and return it (mark online / update last_seen_at).
      if (pErr.code === '23505' || (pErr.details && pErr.details.includes('players_game_name_key'))) {
        try {
          const { data: existingPlayers, error: eErr } = await supabase
            .from('players')
            .select('*')
            .eq('game_id', game.id)
            .eq('name', name)
            .limit(1);
          if (eErr) throw eErr;
          if (existingPlayers && existingPlayers.length > 0) {
            const existing = existingPlayers[0];

            // update last_seen and mark online
            const { error: uErr } = await supabase
              .from('players')
              .update({ is_online: true, last_seen_at: new Date().toISOString() })
              .eq('id', existing.id);
            if (uErr) console.warn('Failed to update existing player last_seen:', uErr.message || uErr);

            // ensure host_player_id is set if missing
            if (!game.host_player_id) {
              const { error: huErr } = await supabase
                .from('games')
                .update({ host_player_id: existing.id })
                .eq('id', game.id);
              if (huErr) console.warn('Failed to set host_player_id:', huErr.message || huErr);
              else game.host_player_id = existing.id;
            }

            return res.status(200).json({ game, player: existing });
          }
          return res.status(500).json({ error: 'Player exists but could not be retrieved' });
        } catch (e) {
          console.error('Error retrieving existing player:', e);
          return res.status(500).json({ error: 'Failed to retrieve existing player' });
        }
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

// Remove a player from a game (delete related events then the player)
app.delete('/games/:code/players/:playerId', async (req, res) => {
  try {
    const { code, playerId } = req.params;

    // find the game by code
    const { data: games, error: gErr } = await supabase
      .from('games')
      .select('*')
      .eq('code', code)
      .limit(1);
    if (gErr) throw gErr;
    if (!games || games.length === 0) return res.status(404).json({ error: 'Game not found' });
    const game = games[0];

    // delete money events referencing this player in the game
    try {
      const meCond = `actor_player_id.eq.${playerId},from_player_id.eq.${playerId},to_player_id.eq.${playerId}`;
      const { error: meErr } = await supabase
        .from('money_events')
        .delete()
        .or(meCond)
        .eq('game_id', game.id);
      if (meErr) console.warn('Failed to delete money_events for player:', meErr.message || meErr);
    } catch (e) {
      console.warn('Error deleting money events:', e.message || e);
    }

    // delete sip events referencing this player in the game
    try {
      const seCond = `from_player_id.eq.${playerId},to_player_id.eq.${playerId}`;
      const { error: seErr } = await supabase
        .from('sip_events')
        .delete()
        .or(seCond)
        .eq('game_id', game.id);
      if (seErr) console.warn('Failed to delete sip_events for player:', seErr.message || seErr);
    } catch (e) {
      console.warn('Error deleting sip events:', e.message || e);
    }

    // if this player was host, clear host_player_id
    try {
      const { error: uErr } = await supabase
        .from('games')
        .update({ host_player_id: null })
        .eq('id', game.id)
        .eq('host_player_id', playerId);
      if (uErr) console.warn('Failed to clear host_player_id:', uErr.message || uErr);
    } catch (e) {
      console.warn('Error clearing host_player_id:', e.message || e);
    }

    // finally delete the player
    const { error: pErr } = await supabase
      .from('players')
      .delete()
      .eq('id', playerId)
      .eq('game_id', game.id);
    if (pErr) {
      console.error('Delete player error:', pErr);
      return res.status(500).json({ error: 'Failed to remove player' });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Remove player error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
