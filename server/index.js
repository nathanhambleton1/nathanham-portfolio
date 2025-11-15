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

// Get players for a game by code
app.get('/games/:code/players', async (req, res) => {
  try {
    const code = req.params.code;
    const { data: games, error: gErr } = await supabase
      .from('games')
      .select('id')
      .eq('code', code)
      .limit(1);
    if (gErr) throw gErr;
    if (!games || games.length === 0) return res.status(404).json({ error: 'Game not found' });
    const game = games[0];

    const { data: players, error: pErr } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', game.id)
      .order('created_at', { ascending: true });
    if (pErr) throw pErr;
    return res.json({ players: players || [] });
  } catch (err) {
    console.error('Get players error:', err);
    return res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// Process payments for a game
app.post('/games/:code/payments', async (req, res) => {
  try {
    const code = req.params.code;
    const { actor_player_id, payments = [], opts = {} } = req.body || {};
    if (!actor_player_id) return res.status(400).json({ error: 'actor_player_id is required' });
    if (!Array.isArray(payments) || payments.length === 0) return res.status(400).json({ error: 'payments are required' });

    // find game
    const { data: games, error: gErr } = await supabase
      .from('games')
      .select('*')
      .eq('code', code)
      .limit(1);
    if (gErr) throw gErr;
    if (!games || games.length === 0) return res.status(404).json({ error: 'Game not found' });
    const game = games[0];

    // fetch actor to validate and get current balance
    const { data: actorRows, error: aErr } = await supabase
      .from('players')
      .select('*')
      .eq('id', actor_player_id)
      .eq('game_id', game.id)
      .limit(1);
    if (aErr) throw aErr;
    if (!actorRows || actorRows.length === 0) return res.status(404).json({ error: 'Actor player not found in game' });
    const actor = actorRows[0];

    // handle tax distribution to all other players when requested
    let meData = [];
    let total = 0;
    if (opts.mode === 'tax' && !opts.freeParking && payments.length === 1 && (payments[0].to == null)) {
      // distribute payments[0].amount to all other players
      const amountPer = Number(payments[0].amount || 0);
      const { data: allPlayers, error: apErr } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', game.id);
      if (apErr) throw apErr;
      const recipients = (allPlayers || []).filter((p) => p.id !== actor_player_id);
      total = amountPer * recipients.length;
      const inserts = recipients.map((r) => ({
        game_id: game.id,
        actor_player_id: actor_player_id,
        from_player_id: actor_player_id,
        to_player_id: r.id,
        amount: amountPer,
        type: opts.type || 'tax',
        description: opts.description || null,
      }));
      const { data: inserted, error: meErr } = await supabase
        .from('money_events')
        .insert(inserts)
        .select();
      if (meErr) throw meErr;
      meData = inserted;

      // credit each recipient
      for (const r of recipients) {
        const newBal = (r.balance || 0) + amountPer;
        const { error: uRecErr } = await supabase
          .from('players')
          .update({ balance: newBal })
          .eq('id', r.id);
        if (uRecErr) throw uRecErr;
      }
    } else {
      // normal behavior: create entries for provided payments
      total = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const inserts = payments.map((p) => {
        return {
          game_id: game.id,
          actor_player_id: actor_player_id,
          from_player_id: p.from_player_id || actor_player_id,
          to_player_id: p.to || null,
          amount: Number(p.amount) || 0,
          type: opts.type || (opts.freeParking ? 'tax' : 'manual'),
          description: opts.description || null,
        };
      });
      const { data: inserted, error: meErr } = await supabase
        .from('money_events')
        .insert(inserts)
        .select();
      if (meErr) throw meErr;
      meData = inserted;

      // credit recipients
      const recipientMap = new Map();
      for (const p of payments) {
        if (!p.to) continue;
        recipientMap.set(p.to, (recipientMap.get(p.to) || 0) + Number(p.amount || 0));
      }
      for (const [rid, amt] of recipientMap.entries()) {
        const { data: rRows, error: rErr } = await supabase
          .from('players')
          .select('*')
          .eq('id', rid)
          .eq('game_id', game.id)
          .limit(1);
        if (rErr) throw rErr;
        if (!rRows || rRows.length === 0) {
          console.warn('Recipient not found in game, skipping credit:', rid);
          continue;
        }
        const recipient = rRows[0];
        const newBal = (recipient.balance || 0) + amt;
        const { error: uRecErr } = await supabase
          .from('players')
          .update({ balance: newBal })
          .eq('id', rid);
        if (uRecErr) throw uRecErr;
      }
    }

    // decrement actor balance (take the money out of the payer)
    try {
      const { error: uActorErr } = await supabase
        .from('players')
        .update({ balance: (actor.balance || 0) - total })
        .eq('id', actor_player_id);
      if (uActorErr) throw uActorErr;
    } catch (e) {
      console.error('Failed to update actor balance:', e);
      return res.status(500).json({ error: 'Failed to update payer balance' });
    }

    // if freeParking option present, increment game's free_parking_balance
    if (opts.freeParking) {
      const add = total;
      const { error: upgErr } = await supabase
        .from('games')
        .update({ free_parking_balance: (game.free_parking_balance || 0) + add })
        .eq('id', game.id);
      if (upgErr) throw upgErr;
    }

    return res.json({ ok: true, money_events: meData });
  } catch (err) {
    console.error('Process payments error:', err);
    return res.status(500).json({ error: err.message || 'Failed to process payments' });
  }
});

// Collect money for a player (bank, pass_go, free_parking)
app.post('/games/:code/collect', async (req, res) => {
  try {
    const code = req.params.code;
    const { actor_player_id, opts = {} } = req.body || {};
    if (!actor_player_id) return res.status(400).json({ error: 'actor_player_id is required' });

    // find game
    const { data: games, error: gErr } = await supabase
      .from('games')
      .select('*')
      .eq('code', code)
      .limit(1);
    if (gErr) throw gErr;
    if (!games || games.length === 0) return res.status(404).json({ error: 'Game not found' });
    const game = games[0];

    // fetch player
    const { data: pRows, error: pErr } = await supabase
      .from('players')
      .select('*')
      .eq('id', actor_player_id)
      .eq('game_id', game.id)
      .limit(1);
    if (pErr) throw pErr;
    if (!pRows || pRows.length === 0) return res.status(404).json({ error: 'Player not found in game' });
    const player = pRows[0];

    let amount = 0;
    let meRow = null;

    if (opts.type === 'bank') {
      amount = Number(opts.amount || 0);
      if (amount <= 0) return res.status(400).json({ error: 'Invalid amount for bank collect' });

      // create money_event (bank -> player)
      const { data: meData, error: meErr } = await supabase
        .from('money_events')
        .insert([{ game_id: game.id, actor_player_id, from_player_id: null, to_player_id: actor_player_id, amount, type: 'bank', description: opts.description || null }])
        .select()
        .single();
      if (meErr) throw meErr;
      meRow = meData;

    } else if (opts.type === 'pass_go') {
      const base = Number(game.pass_go_amount || 200);
      const doubled = !!opts.doubled;
      amount = doubled ? base * 2 : base;

      const { data: meData, error: meErr } = await supabase
        .from('money_events')
        .insert([{ game_id: game.id, actor_player_id, from_player_id: null, to_player_id: actor_player_id, amount, type: 'go', description: opts.description || null }])
        .select()
        .single();
      if (meErr) throw meErr;
      meRow = meData;

    } else if (opts.type === 'free_parking') {
      const pot = Number(game.free_parking_balance || 0);
      if (pot <= 0) return res.status(400).json({ error: 'Free parking pot is empty' });
      amount = pot;

      // create money_event recording collect from free parking (bank-like)
      const { data: meData, error: meErr } = await supabase
        .from('money_events')
        .insert([{ game_id: game.id, actor_player_id, from_player_id: null, to_player_id: actor_player_id, amount, type: 'free_parking_collect', description: opts.description || null }])
        .select()
        .single();
      if (meErr) throw meErr;
      meRow = meData;

      // clear pot
      const { error: upgErr } = await supabase
        .from('games')
        .update({ free_parking_balance: 0 })
        .eq('id', game.id);
      if (upgErr) throw upgErr;

    } else {
      return res.status(400).json({ error: 'Invalid collect type' });
    }

    // credit player's balance
    const newBal = (player.balance || 0) + amount;
    const { error: upErr } = await supabase
      .from('players')
      .update({ balance: newBal })
      .eq('id', actor_player_id);
    if (upErr) throw upErr;

    return res.json({ ok: true, money_event: meRow, new_balance: newBal });
  } catch (err) {
    console.error('Collect error:', err);
    return res.status(500).json({ error: err.message || 'Failed to process collect' });
  }
});

// Assign sips from one player to another
app.post('/games/:code/sips', async (req, res) => {
  try {
    const code = req.params.code;
    const { actor_player_id, to_player_id, sip_count } = req.body || {};
    if (!actor_player_id) return res.status(400).json({ error: 'actor_player_id is required' });
    if (!to_player_id) return res.status(400).json({ error: 'to_player_id is required' });
    const count = Number(sip_count || 0);
    if (count <= 0) return res.status(400).json({ error: 'sip_count must be greater than 0' });

    // find game
    const { data: games, error: gErr } = await supabase
      .from('games')
      .select('*')
      .eq('code', code)
      .limit(1);
    if (gErr) throw gErr;
    if (!games || games.length === 0) return res.status(404).json({ error: 'Game not found' });
    const game = games[0];

    // insert sip event
    const insertRow = {
      game_id: game.id,
      from_player_id: actor_player_id,
      to_player_id: to_player_id,
      sip_count: count,
      status: 'pending',
    };
    const { data: inserted, error: iErr } = await supabase
      .from('sip_events')
      .insert([insertRow])
      .select();
    if (iErr) throw iErr;

    // increment recipient pending_sips by reading current value and updating
    const { data: rRows, error: rErr } = await supabase
      .from('players')
      .select('*')
      .eq('id', to_player_id)
      .eq('game_id', game.id)
      .limit(1);
    if (rErr) throw rErr;
    if (!rRows || rRows.length === 0) {
      return res.status(404).json({ error: 'Recipient not found in game' });
    }
    const recipient = rRows[0];
    const newPending = (recipient.pending_sips || 0) + count;
    const { error: uErr } = await supabase
      .from('players')
      .update({ pending_sips: newPending })
      .eq('id', to_player_id);
    if (uErr) throw uErr;

    return res.json({ ok: true, sip_event: Array.isArray(inserted) ? inserted[0] : inserted });
  } catch (err) {
    console.error('Assign sips error:', err);
    return res.status(500).json({ error: err.message || 'Failed to assign sips' });
  }
});

// Complete pending sips for a player (player acknowledges they've finished)
app.post('/games/:code/sips/complete', async (req, res) => {
  try {
    const code = req.params.code;
    const { actor_player_id } = req.body || {};
    if (!actor_player_id) return res.status(400).json({ error: 'actor_player_id is required' });

    // find game
    const { data: games, error: gErr } = await supabase
      .from('games')
      .select('*')
      .eq('code', code)
      .limit(1);
    if (gErr) throw gErr;
    if (!games || games.length === 0) return res.status(404).json({ error: 'Game not found' });
    const game = games[0];

    // mark sip_events as cleared
    const { data: updated, error: uErr } = await supabase
      .from('sip_events')
      .update({ status: 'cleared', cleared_at: new Date().toISOString() })
      .eq('game_id', game.id)
      .eq('to_player_id', actor_player_id)
      .eq('status', 'pending')
      .select();
    if (uErr) throw uErr;

    // set player's pending_sips to zero
    const { error: pErr } = await supabase
      .from('players')
      .update({ pending_sips: 0 })
      .eq('id', actor_player_id);
    if (pErr) throw pErr;

    return res.json({ ok: true, cleared: updated ? updated.length : 0 });
  } catch (err) {
    console.error('Complete sips error:', err);
    return res.status(500).json({ error: err.message || 'Failed to complete sips' });
  }
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

// Get recent activity events for a game (money + sips)
app.get('/games/:code/events', async (req, res) => {
  try {
    const code = req.params.code;
    const limit = Number(req.query.limit || 100);

    const { data: games, error: gErr } = await supabase
      .from('games')
      .select('*')
      .eq('code', code)
      .limit(1);
    if (gErr) throw gErr;
    if (!games || games.length === 0) return res.status(404).json({ error: 'Game not found' });
    const game = games[0];

    // read from the view `game_events` which combines money_events and sip_events
    const { data: events, error: eErr } = await supabase
      .from('game_events')
      .select('id,game_id,created_at,kind,type,actor_player_id,from_player_id,to_player_id,amount,sip_count,description')
      .eq('game_id', game.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (eErr) throw eErr;

    return res.json({ events: events || [] });
  } catch (err) {
    console.error('Get events error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch events' });
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
