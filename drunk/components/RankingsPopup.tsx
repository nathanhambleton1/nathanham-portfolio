import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Card } from "./ui/card";
import { createClient } from "@supabase/supabase-js";
import { Crown, Zap } from "lucide-react";
import { calculateWinProbabilities, WinProbabilityResult, PlayerStats } from "../lib/winProbability";
import { MONOPOLY_PROPERTIES, calculatePropertyValue } from "../lib/monopoly-properties";

const supabaseUrl = 'https://kcyrvubzhsphpxfsewii.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjeXJ2dWJ6aHNwaHB4ZnNld2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxODAwMTcsImV4cCI6MjA3ODc1NjAxN30.8psClrpif-F1DWj67u2tErnU8-4ZYjw5LvEfRK3oHkI';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface PropertyOwnership {
  id: string;
  game_id: string;
  player_id: string | null;
  property_id: string;
  houses: number;
  is_mortgaged: boolean;
}

interface RankingsPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameCode: string;
  players: any[];
}

const RankingsPopup = ({ open, onOpenChange, gameCode, players }: RankingsPopupProps) => {
  const [ownerships, setOwnerships] = useState<PropertyOwnership[]>([]);
  const [playerStats, setPlayerStats] = useState<Map<string, PlayerStats>>(new Map());
  const [gameInfo, setGameInfo] = useState<{ created_at: string; sips_enabled: boolean } | null>(null);
  const [winProbabilities, setWinProbabilities] = useState<WinProbabilityResult[]>([]);

  useEffect(() => {
    if (!open || !gameCode) return;
    let mounted = true;
    let localGameId: string | null = null;

    // Fetch only ownerships without toggling a loading UI so updates can be
    // applied silently. Only update state when data actually differs to
    // reduce re-renders and avoid dialog flash.
    const fetchOwnerships = async () => {
      if (!localGameId) return;
      try {
        const { data: props, error: pErr } = await supabase
          .from('property_ownership')
          .select('*')
          .eq('game_id', localGameId);

        if (!mounted) return;
        if (pErr || !props) return;

        // If we previously had no ownerships, set directly so UI populates
        // immediately rather than waiting for a later merge step.
        setOwnerships(prev => {
          if (!prev || prev.length === 0) return props as any;
          if (prev.length !== props.length) return props as any;

          const prevMap = new Map(prev.map(p => [String(p.id), p]));
          let changed = false;

          const merged = (props as any).map((np: any) => {
            const p = prevMap.get(String(np.id));
            if (!p) { changed = true; return np; }
            if (p.houses !== np.houses || p.is_mortgaged !== np.is_mortgaged || String(p.player_id) !== String(np.player_id)) {
              changed = true;
              return np;
            }
            return p; // reuse previous object to avoid unnecessary re-renders
          });

          if (!changed) return prev;
          return merged as any;
        });
        console.debug('RankingsPopup: ownerships updated (merge)', { length: (props as any).length });
      } catch (e) {
        console.warn('Failed to fetch ownerships', e);
      }
    };

    // Fetch player statistics silently
    const fetchPlayerStats = async () => {
      if (!localGameId) return;
      try {
        const { data: stats, error: statsErr } = await supabase
          .from('player_statistics')
          .select('*')
          .eq('game_id', localGameId);

        if (!mounted) return;
        if (stats && !statsErr) {
          const statsMap = new Map<string, PlayerStats>();
          stats.forEach((stat: any) => {
            statsMap.set(stat.player_id, {
              times_passed_go: stat.times_passed_go || 0,
              times_went_to_jail: stat.times_went_to_jail || 0,
              times_landed_free_parking: stat.times_landed_free_parking || 0,
              total_tax_paid: stat.total_tax_paid || 0,
              total_rent_paid: stat.total_rent_paid || 0,
              total_rent_received: stat.total_rent_received || 0,
              times_others_landed_on_properties: stat.times_others_landed_on_properties || 0,
              current_luck_score: stat.current_luck_score || 0
            });
          });
          setPlayerStats(statsMap);
          console.debug('RankingsPopup: player stats updated', { count: statsMap.size });
        }
      } catch (e) {
        console.warn('Failed to fetch player stats', e);
      }
    };

    const fetchData = async () => {
      try {
        const { data: games, error: gErr } = await supabase
          .from('games')
          .select('id, created_at, sips_enabled')
          .eq('code', gameCode)
          .limit(1);

        if (gErr || !games || games.length === 0) return;
        localGameId = games[0].id;
        if (!mounted) return;
        setGameInfo({ created_at: games[0].created_at, sips_enabled: games[0].sips_enabled });
        console.debug('RankingsPopup: fetched game id', localGameId);

        // initial fetches
        await fetchPlayerStats();
        await fetchOwnerships();
      } catch (e) {
        console.warn('Rankings fetch failed', e);
      }
    };

    fetchData();

    let subscriptions: any[] = [];
    const setupSubscriptions = () => {
      if (!localGameId) return;

      try {
        // Subscribe to property_ownership changes
        const propertySubscription = supabase
          .channel(`rankings_properties_${gameCode}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'property_ownership', filter: `game_id=eq.${localGameId}` },
            async () => {
              console.debug('RankingsPopup: property_ownership changed');
              await fetchOwnerships();
            }
          )
          .subscribe();
        subscriptions.push(propertySubscription);

        // Subscribe to players table changes (balance updates)
        const playersSubscription = supabase
          .channel(`rankings_players_${gameCode}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'players', filter: `game_id=eq.${localGameId}` },
            async (payload) => {
              console.debug('RankingsPopup: players table changed', payload);
              // Players are passed as props, but we trigger a re-render by updating a timestamp
              // The parent should handle updating players, but this ensures we recalculate
            }
          )
          .subscribe();
        subscriptions.push(playersSubscription);

        // Subscribe to player_statistics changes
        const statsSubscription = supabase
          .channel(`rankings_stats_${gameCode}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'player_statistics', filter: `game_id=eq.${localGameId}` },
            async () => {
              console.debug('RankingsPopup: player_statistics changed');
              await fetchPlayerStats();
            }
          )
          .subscribe();
        subscriptions.push(statsSubscription);
      } catch (e) {
        console.warn('Rankings subscriptions failed', e);
      }
    };

    const idTimer = window.setInterval(() => {
      if (localGameId) { setupSubscriptions(); clearInterval(idTimer); }
    }, 250);

    const poll = window.setInterval(() => { 
      if (localGameId && mounted) {
        fetchOwnerships();
        fetchPlayerStats();
      }
    }, 2000);

    return () => {
      mounted = false;
      try {
        subscriptions.forEach(sub => {
          if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe();
        });
      } catch (e) {
        try { 
          subscriptions.forEach(sub => {
            (supabase as any).removeChannel?.(sub);
          });
        } catch (ignored) {}
      }
      clearInterval(idTimer);
      clearInterval(poll);
    };
  }, [open, gameCode, players.length]);

  const calculateRankings = () => {
    const rankings = players.map(player => {
      const balance = player.balance || 0;
      const playerProperties = ownerships.filter(o => o.player_id === player.id);

      let propertyValue = 0;
      playerProperties.forEach(ownership => {
        const property = MONOPOLY_PROPERTIES.find(p => p.id === ownership.property_id);
        if (property) {
          propertyValue += calculatePropertyValue(property, ownership.houses);
          if (ownership.is_mortgaged) propertyValue -= property.mortgageValue;
        }
      });

      return {
        player,
        balance,
        propertyValue,
        totalValue: balance + propertyValue,
        propertyCount: playerProperties.length
      };
    });
    return rankings.sort((a, b) => b.totalValue - a.totalValue);
  };

  useEffect(() => {
    if (!gameInfo || players.length === 0) { setWinProbabilities([]); return; }
    try {
      const probabilities = calculateWinProbabilities(players, ownerships, playerStats, gameInfo);
      setWinProbabilities(probabilities);
    } catch (e) {
      console.warn('Failed to calculate win probs', e);
      setWinProbabilities([]);
    }
  }, [players, ownerships, playerStats, gameInfo]);

  const rankings = calculateRankings();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Crown className="w-6 h-6 text-yellow-500" />
            Rankings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {(() => {
            const rankedWithProbs = rankings.map(rank => {
              const prob = winProbabilities.find(p => p.playerId === rank.player.id);
              return { ...rank, winProbability: prob?.winProbability || 0, breakdown: prob?.breakdown };
            }).sort((a, b) => b.winProbability - a.winProbability);

            return rankedWithProbs.map((rank, index) => (
              <Card key={rank.player.id} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-bold text-muted-foreground w-8">#{index + 1}</div>
                    {index === 0 && <Crown className="w-5 h-5 text-yellow-500" />}
                    <div className="flex-1">
                      <div className="font-semibold text-lg">{rank.player.name}</div>
                      <div className="text-sm text-muted-foreground">{rank.propertyCount} propert{rank.propertyCount !== 1 ? 'ies' : 'y'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-primary flex items-center gap-2">
                        {rank.winProbability > 0 ? (
                          <>
                            {rank.winProbability.toFixed(1)}%
                            {rank.winProbability > 50 && <Zap className="w-6 h-6 text-yellow-500" />}
                          </>
                        ) : (<span className="text-muted-foreground">—</span>)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Win Probability</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                    <div>
                      <div className="text-xs text-muted-foreground">Total Value</div>
                      <div className="text-lg font-semibold">${rank.totalValue.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Cash</div>
                      <div className="text-lg font-semibold">${rank.balance.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Properties</div>
                      <div className="text-lg font-semibold">${rank.propertyValue.toLocaleString()}</div>
                    </div>
                    {rank.breakdown && (
                      <div>
                        <div className="text-xs text-muted-foreground">Strategy Score</div>
                        <div className="text-lg font-semibold">{rank.breakdown.strategyScore.toFixed(0)}</div>
                      </div>
                    )}
                  </div>

                  {rank.breakdown && (
                    <div className="pt-3 border-t">
                      <div className="text-xs font-semibold mb-2 text-muted-foreground">Score Breakdown</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between"><span className="text-muted-foreground">Assets:</span><span className="font-medium">{rank.breakdown.assetScore.toFixed(0)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Strategy:</span><span className="font-medium">{rank.breakdown.strategyScore.toFixed(0)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Luck:</span><span className={`font-medium ${rank.breakdown.luckScore >= 0 ? 'text-green-600' : 'text-red-600'}`}>{rank.breakdown.luckScore >= 0 ? '+' : ''}{rank.breakdown.luckScore.toFixed(0)}</span></div>
                        {gameInfo?.sips_enabled && rank.breakdown.sipPenalty !== 0 && (<div className="flex justify-between"><span className="text-muted-foreground">Sip Penalty:</span><span className="font-medium text-orange-600">{rank.breakdown.sipPenalty.toFixed(0)}</span></div>)}
                        <div className="flex justify-between"><span className="text-muted-foreground">Game Phase:</span><span className="font-medium">{rank.breakdown.gamePhaseScore === 0 ? 'Early' : rank.breakdown.gamePhaseScore === 1 ? 'Mid' : 'Late'}</span></div>
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${Math.max(2, Math.min(100, rank.winProbability || 0))}%` }} />
                    </div>
                  </div>
                </div>
              </Card>
            ));
          })()}

          {winProbabilities.length === 0 && players.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No players in the game yet</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RankingsPopup;
