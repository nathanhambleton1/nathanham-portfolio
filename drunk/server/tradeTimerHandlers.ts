// Sample server-side helpers for starting/stopping the trade timer.
// This file is a minimal, framework-agnostic example. Adapt to your server stack.

import { PoolClient } from 'pg';

type Broadcaster = (event: string, payload: any) => void;

export async function startTradeTimer(db: PoolClient, broadcaster: Broadcaster, gameId: string, playerId: string, seconds: number) {
  const sql = `
    UPDATE public.games
    SET trade_locked = true,
        trade_started_by = $2,
        trade_timer_seconds = $3,
        trade_timer_expires_at = now() + ($3 || ' seconds')::interval,
        updated_at = now()
    WHERE id = $1
    RETURNING id, trade_timer_seconds, trade_timer_expires_at, trade_started_by;
  `;
  const res = await db.query(sql, [gameId, playerId, seconds]);
  if (res.rowCount === 0) throw new Error('game-not-found');
  const row = res.rows[0];

  // Broadcast to clients (implement broadcaster per your WS system)
  broadcaster('trade_timer_started', {
    gameId: row.id,
    startedBy: row.trade_started_by,
    seconds: row.trade_timer_seconds,
    expiresAt: row.trade_timer_expires_at,
  });

  return row;
}

export async function stopTradeTimer(db: PoolClient, broadcaster: Broadcaster, gameId: string, stoppedBy?: string) {
  const sql = `
    UPDATE public.games
    SET trade_locked = false,
        trade_started_by = NULL,
        trade_timer_expires_at = NULL,
        updated_at = now()
    WHERE id = $1
    RETURNING id;
  `;
  const res = await db.query(sql, [gameId]);
  if (res.rowCount === 0) throw new Error('game-not-found');

  broadcaster('trade_timer_stopped', { gameId });
  return { id: gameId };
}

// Optional: a helper to auto-expire timers (run periodically)
export async function expireTimers(db: PoolClient, broadcaster: Broadcaster) {
  const sql = `
    UPDATE public.games
    SET trade_locked = false,
        trade_started_by = NULL,
        trade_timer_expires_at = NULL,
        updated_at = now()
    WHERE trade_locked = true AND trade_timer_expires_at <= now()
    RETURNING id;
  `;
  const res = await db.query(sql);
  for (const row of res.rows) {
    broadcaster('trade_timer_expired', { gameId: row.id });
  }
  return res.rowCount;
}
