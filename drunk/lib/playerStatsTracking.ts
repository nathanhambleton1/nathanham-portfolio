/**
 * Helper functions for updating player statistics in Drunkopoly
 * These functions should be called whenever relevant game events occur
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = 'https://kcyrvubzhsphpxfsewii.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjeXJ2dWJ6aHNwaHB4ZnNld2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxODAwMTcsImV4cCI6MjA3ODc1NjAxN30.8psClrpif-F1DWj67u2tErnU8-4ZYjw5LvEfRK3oHkI';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Initialize player statistics for a new player
 */
export async function initializePlayerStats(gameId: string, playerId: string) {
  try {
    // Check if stats already exist
    const { data: existing } = await supabase
      .from('player_statistics')
      .select('id')
      .eq('game_id', gameId)
      .eq('player_id', playerId)
      .single();
    
    if (existing) return; // Already initialized
    
    const { error } = await supabase
      .from('player_statistics')
      .insert({
        game_id: gameId,
        player_id: playerId,
        times_passed_go: 0,
        times_went_to_jail: 0,
        times_landed_free_parking: 0,
        money_received_from_go: 0,
        money_received_from_free_parking: 0,
        money_received_from_players: 0,
        money_received_from_bank: 0,
        total_money_received: 0,
        money_paid_to_bank: 0,
        money_paid_to_players: 0,
        money_paid_for_jail: 0,
        total_money_spent: 0,
        total_tax_paid: 0,
        total_rent_paid: 0,
        total_rent_received: 0,
        times_others_landed_on_properties: 0,
        current_luck_score: 0
      });
    
    if (error) throw error;
  } catch (err) {
    console.error('Failed to initialize player stats:', err);
  }
}

/**
 * Core function to update player stats atomically
 * Uses increment operation to avoid race conditions
 */
async function incrementStats(gameId: string, playerId: string, updates: Record<string, number>) {
  try {
    // Ensure stats exist first
    await initializePlayerStats(gameId, playerId);
    
    // Fetch current stats
    const { data: current, error: fetchErr } = await supabase
      .from('player_statistics')
      .select('*')
      .eq('game_id', gameId)
      .eq('player_id', playerId)
      .single();
    
    if (fetchErr || !current) {
      console.error('Failed to fetch current stats:', fetchErr);
      return;
    }
    
    // Calculate new values
    const newValues: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const [key, increment] of Object.entries(updates)) {
      newValues[key] = (current[key] || 0) + increment;
    }
    
    // Update
    const { error: updateErr } = await supabase
      .from('player_statistics')
      .update(newValues)
      .eq('game_id', gameId)
      .eq('player_id', playerId);
    
    if (updateErr) throw updateErr;
  } catch (err) {
    console.error('Failed to increment stats:', err);
  }
}

/**
 * Track money received from passing Go
 */
export async function trackMoneyFromGo(gameId: string, playerId: string, amount: number) {
  await incrementStats(gameId, playerId, {
    times_passed_go: 1,
    money_received_from_go: amount,
    total_money_received: amount
  });
}

/**
 * Track money received from Free Parking
 */
export async function trackMoneyFromFreeParking(gameId: string, playerId: string, amount: number) {
  await incrementStats(gameId, playerId, {
    times_landed_free_parking: 1,
    money_received_from_free_parking: amount,
    total_money_received: amount
  });
}

/**
 * Track money received from the bank (excluding Go and Free Parking)
 */
export async function trackMoneyFromBank(gameId: string, playerId: string, amount: number) {
  await incrementStats(gameId, playerId, {
    money_received_from_bank: amount,
    total_money_received: amount
  });
}

/**
 * Track money received from another player
 */
export async function trackMoneyFromPlayer(gameId: string, receiverId: string, amount: number, isRent: boolean = false) {
  const updates: Record<string, number> = {
    money_received_from_players: amount,
    total_money_received: amount
  };
  
  if (isRent) {
    updates.total_rent_received = amount;
    updates.times_others_landed_on_properties = 1;
  }
  
  await incrementStats(gameId, receiverId, updates);
}

/**
 * Track money paid to the bank (tax, fees, etc.)
 */
export async function trackMoneyToBank(gameId: string, payerId: string, amount: number, isTax: boolean = false) {
  const updates: Record<string, number> = {
    money_paid_to_bank: amount,
    total_money_spent: amount
  };
  
  if (isTax) {
    updates.total_tax_paid = amount;
  }
  
  await incrementStats(gameId, payerId, updates);
}

/**
 * Track money paid to another player
 */
export async function trackMoneyToPlayer(gameId: string, payerId: string, amount: number, isRent: boolean = false) {
  const updates: Record<string, number> = {
    money_paid_to_players: amount,
    total_money_spent: amount
  };
  
  if (isRent) {
    updates.total_rent_paid = amount;
  }
  
  await incrementStats(gameId, payerId, updates);
}

/**
 * Track jail payment
 */
export async function trackJailPayment(gameId: string, playerId: string, amount: number) {
  await incrementStats(gameId, playerId, {
    money_paid_for_jail: amount,
    money_paid_to_bank: amount,
    total_money_spent: amount
  });
}

/**
 * Track going to jail
 */
export async function trackWentToJail(gameId: string, playerId: string) {
  await incrementStats(gameId, playerId, {
    times_went_to_jail: 1
  });
}

/**
 * Update luck score based on recent events
 */
export async function updateLuckScore(gameId: string, playerId: string, delta: number) {
  try {
    const { data, error } = await supabase
      .from('player_statistics')
      .select('current_luck_score')
      .eq('game_id', gameId)
      .eq('player_id', playerId)
      .single();
    
    if (error) {
      await initializePlayerStats(gameId, playerId);
      return;
    }
    
    // Clamp luck score between -1.0 and 1.0
    const newLuckScore = Math.max(-1.0, Math.min(1.0, (data.current_luck_score || 0) + delta));
    
    const { error: updateError } = await supabase
      .from('player_statistics')
      .update({ 
        current_luck_score: newLuckScore,
        updated_at: new Date().toISOString()
      })
      .eq('game_id', gameId)
      .eq('player_id', playerId);
    
    if (updateError) throw updateError;
  } catch (err) {
    console.error('Failed to update luck score:', err);
  }
}

/**
 * Get all player statistics for a game
 */
export async function getPlayerStatistics(gameId: string) {
  try {
    const { data, error } = await supabase
      .from('player_statistics')
      .select('*')
      .eq('game_id', gameId);
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Failed to get player statistics:', err);
    return [];
  }
}

/**
 * Get property landing statistics for a game
 */
export async function getPropertyLandingStats(gameId: string) {
  try {
    const { data, error } = await supabase
      .from('property_landing_stats')
      .select('*')
      .eq('game_id', gameId);
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Failed to get property landing stats:', err);
    return [];
  }
}
