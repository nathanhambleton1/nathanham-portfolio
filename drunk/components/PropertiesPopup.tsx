import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { 
  MONOPOLY_PROPERTIES, 
  MonopolyProperty, 
  PropertyColor, 
  PROPERTY_COLORS,
  getPropertiesByColor,
  calculatePropertyValue 
} from "../lib/monopoly-properties";
import { 
  Home, 
  Building2, 
  Crown, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Minus,
  Users,
  TrendingUp,
  Zap,
  TrendingDown
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { toast } from "./ui/use-toast";
import { 
  calculateWinProbabilities, 
  WinProbabilityResult,
  PlayerStats 
} from "../lib/winProbability";

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

interface PropertiesPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameCode: string;
  players: any[];
}

const PropertiesPopup = ({ open, onOpenChange, gameCode, players }: PropertiesPopupProps) => {
  const [ownerships, setOwnerships] = useState<PropertyOwnership[]>([]);
  const [expandedProperty, setExpandedProperty] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'properties' | 'rankings'>('properties');
  const [gameId, setGameId] = useState<string | null>(null);
  const [filterOwner, setFilterOwner] = useState<string>('all');
  const [playerStats, setPlayerStats] = useState<Map<string, PlayerStats>>(new Map());
  const [gameInfo, setGameInfo] = useState<{ created_at: string; sips_enabled: boolean } | null>(null);
  const [winProbabilities, setWinProbabilities] = useState<WinProbabilityResult[]>([]);

  // Fetch game ID and property ownerships. Create realtime subscription after
  // we have the game ID, and add polling as a fallback (like ActivityLog).
  useEffect(() => {
    if (!open || !gameCode) return;

    let mounted = true;
    let localGameId: string | null = null;

    // Fetch only ownerships without toggling the loading UI so updates can be
    // applied silently (avoids popup flash). Only update state when data actually
    // differs to reduce re-renders.
    const fetchOwnerships = async () => {
      if (!localGameId) return;
      try {
        const { data: props, error: pErr } = await supabase
          .from('property_ownership')
          .select('*')
          .eq('game_id', localGameId);

        if (!mounted) return;
        if (pErr || !props) return;

        setOwnerships(prev => {
          if (!prev) return props;
          if (prev.length !== props.length) return props;

          const prevMap = new Map(prev.map(p => [String(p.id), p]));
          let changed = false;

          const merged = props.map((np: any) => {
            const p = prevMap.get(String(np.id));
            if (!p) { changed = true; return np; }
            if (p.houses !== np.houses || p.is_mortgaged !== np.is_mortgaged || String(p.player_id) !== String(np.player_id)) {
              changed = true;
              return np;
            }
            return p; // reuse previous object to avoid unnecessary re-renders
          });

          if (!changed) return prev;
          return merged;
        });
      } catch (err) {
        console.error('Failed to fetch property ownerships:', err);
      }
    };

    const fetchData = async () => {
      try {
        setLoading(true);

        // Get game ID and game info
        const { data: games, error: gErr } = await supabase
          .from('games')
          .select('id, created_at, sips_enabled')
          .eq('code', gameCode)
          .limit(1);

        if (gErr || !games || games.length === 0) return;
        localGameId = games[0].id;
        if (!mounted) return;
        setGameId(localGameId);
        setGameInfo({
          created_at: games[0].created_at,
          sips_enabled: games[0].sips_enabled
        });

        // Fetch player statistics
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
        }

        // initial ownership fetch
        await fetchOwnerships();
      } catch (err) {
        console.error('Failed to fetch property data:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();

    // set up subscription after we have the game id. Instead of refetching the
    // entire dataset on every change (which causes visible refresh/glitching),
    // merge individual changes into `ownerships` so the UI updates subtly.
    let subscription: any = null;
    const setupSubscription = () => {
      if (!localGameId) return;

      try {
        subscription = supabase
          .channel(`properties_${gameCode}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'property_ownership',
              filter: `game_id=eq.${localGameId}`,
            },
            async (payload: any) => {
              if (!mounted) return;
              // Refresh ownerships silently (fetchOwnerships handles minimal updates)
              await fetchOwnerships();
            }
          )
          .subscribe();
      } catch (e) {
        console.warn('Supabase subscription failed', e);
      }
    };

    // Try to set up subscription after initial fetch (poll until id is available)
    const idWaitTimer = window.setInterval(() => {
      if (localGameId) {
        setupSubscription();
        clearInterval(idWaitTimer);
      }
    }, 250);

    // Polling fallback: refresh ownerships periodically in case realtime misses an event.
    // Use `fetchOwnerships` (no loading UI) so updates are applied silently and
    // the dialog doesn't flash or replace its content while open.
    const pollTimer = window.setInterval(() => {
      if (!localGameId || !mounted) return;
      fetchOwnerships();
    }, 2000);

    return () => {
      mounted = false;
      try {
        if (subscription && typeof subscription.unsubscribe === 'function') subscription.unsubscribe();
      } catch (e) {
        try { (supabase as any).removeChannel?.(subscription); } catch (ignored) {}
      }
      clearInterval(idWaitTimer);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [open, gameCode]);

  const getOwnership = (propertyId: string): PropertyOwnership | undefined => {
    return ownerships.find(o => o.property_id === propertyId);
  };

  const getOwnerName = (playerId: string | null): string => {
    if (!playerId) return 'Unowned';
    const player = players.find(p => p.id === playerId);
    return player?.name || 'Unknown';
  };

  const assignProperty = async (property: MonopolyProperty, playerId: string | null) => {
    if (!gameId) return;
    
    const ownership = getOwnership(property.id);
    const prevOwnerships = [...ownerships];
    
    try {
      // Optimistic update: update UI immediately
      if (ownership) {
        if (playerId === null) {
          // Delete ownership (unassign) - remove from state
          setOwnerships(prev => prev.filter(o => o.id !== ownership.id));
        } else {
          // Update ownership - modify in state
          setOwnerships(prev => prev.map(o => 
            o.id === ownership.id 
              ? { ...o, player_id: playerId, updated_at: new Date().toISOString() } 
              : o
          ));
        }
      } else if (playerId !== null) {
        // Create new ownership - add to state with temporary ID
        const tempOwnership: PropertyOwnership = {
          id: `temp-${Date.now()}`,
          game_id: gameId,
          player_id: playerId,
          property_id: property.id,
          houses: 0,
          is_mortgaged: false
        };
        setOwnerships(prev => [...prev, tempOwnership]);
      }
      
      // Persist to backend
      if (ownership) {
        if (playerId === null) {
          // Delete ownership (unassign)
          const { error } = await supabase
            .from('property_ownership')
            .delete()
            .eq('id', ownership.id);
          if (error) throw error;
        } else {
          // Update ownership
          const { error } = await supabase
            .from('property_ownership')
            .update({ player_id: playerId, updated_at: new Date().toISOString() })
            .eq('id', ownership.id);
          if (error) throw error;
        }
      } else if (playerId !== null) {
        // Create new ownership
        const { data, error } = await supabase
          .from('property_ownership')
          .insert({
            game_id: gameId,
            player_id: playerId,
            property_id: property.id,
            houses: 0,
            is_mortgaged: false
          })
          .select()
          .single();
        
        if (error) throw error;
        
        // Replace temp ownership with real one from backend
        if (data) {
          setOwnerships(prev => prev.map(o => 
            o.property_id === property.id && o.id.startsWith('temp-') 
              ? data 
              : o
          ));
        }
      }
      
      // silent success: UI is updated optimistically and real-time subscription will confirm
    } catch (err) {
      console.error('Failed to assign property:', err);
      // Revert optimistic update on error
      setOwnerships(prevOwnerships);
      toast({
        title: 'Error',
        description: 'Failed to update property ownership',
        variant: 'destructive'
      });
    }
  };

  const updateHouses = async (property: MonopolyProperty, delta: number) => {
    if (!gameId) return;
    
    const ownership = getOwnership(property.id);
    if (!ownership) {
      toast({
        title: 'Cannot add houses',
        description: 'Property must be owned first',
        variant: 'destructive'
      });
      return;
    }

    if (ownership.is_mortgaged) {
      toast({
        title: 'Cannot add houses',
        description: 'You cannot add houses to a mortgaged property',
        variant: 'destructive'
      });
      return;
    }
    
    const newHouses = Math.max(0, Math.min(5, ownership.houses + delta));
    const prevOwnerships = [...ownerships];
    
    try {
      // Optimistic update: update UI immediately
      setOwnerships(prev => prev.map(o => 
        o.id === ownership.id 
          ? { ...o, houses: newHouses, updated_at: new Date().toISOString() } 
          : o
      ));
      
      // Persist to backend
      const { error } = await supabase
        .from('property_ownership')
        .update({ houses: newHouses, updated_at: new Date().toISOString() })
        .eq('id', ownership.id);
      
      if (error) throw error;
      
      // silent success: UI is updated optimistically and real-time subscription will confirm
    } catch (err) {
      console.error('Failed to update houses:', err);
      // Revert optimistic update on error
      setOwnerships(prevOwnerships);
      toast({
        title: 'Error',
        description: 'Failed to update houses',
        variant: 'destructive'
      });
    }
  };

  const toggleMortgage = async (property: MonopolyProperty) => {
    if (!gameId) return;
    
    const ownership = getOwnership(property.id);
    if (!ownership) return;
    
    const prevOwnerships = [...ownerships];
    const newMortgageState = !ownership.is_mortgaged;
    
    try {
      // Optimistic update: update UI immediately
      // If mortgaging, clear all houses/hotel (set to 0)
      setOwnerships(prev => prev.map(o => 
        o.id === ownership.id 
          ? { ...o, is_mortgaged: newMortgageState, houses: newMortgageState ? 0 : o.houses, updated_at: new Date().toISOString() } 
          : o
      ));
      
      // Persist to backend; when mortgaging also clear houses
      const { error } = await supabase
        .from('property_ownership')
        .update({ 
          is_mortgaged: newMortgageState,
          houses: newMortgageState ? 0 : ownership.houses,
          updated_at: new Date().toISOString() 
        })
        .eq('id', ownership.id);
      
      if (error) throw error;
      
      // silent success: UI is updated optimistically and real-time subscription will confirm
    } catch (err) {
      console.error('Failed to toggle mortgage:', err);
      // Revert optimistic update on error
      setOwnerships(prevOwnerships);
      toast({
        title: 'Error',
        description: 'Failed to toggle mortgage',
        variant: 'destructive'
      });
    }
  };

  // Calculate player rankings
  const calculateRankings = () => {
    const rankings = players.map(player => {
      const balance = player.balance || 0;
      const playerProperties = ownerships.filter(o => o.player_id === player.id);
      
      let propertyValue = 0;
      playerProperties.forEach(ownership => {
        const property = MONOPOLY_PROPERTIES.find(p => p.id === ownership.property_id);
        if (property) {
          propertyValue += calculatePropertyValue(property, ownership.houses);
          if (ownership.is_mortgaged) {
            propertyValue -= property.mortgageValue;
          }
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

  // Calculate win probabilities whenever data changes
  useEffect(() => {
    if (!gameInfo || players.length === 0) {
      setWinProbabilities([]);
      return;
    }

    try {
      const probabilities = calculateWinProbabilities(
        players,
        ownerships,
        playerStats,
        gameInfo
      );
      setWinProbabilities(probabilities);
    } catch (err) {
      console.error('Failed to calculate win probabilities:', err);
      setWinProbabilities([]);
    }
  }, [players, ownerships, playerStats, gameInfo]);

  const PropertyCard = ({ property }: { property: MonopolyProperty }) => {
    const ownership = getOwnership(property.id);
    const isExpanded = expandedProperty === property.id;
    const colorStyle = PROPERTY_COLORS[property.color];
    const ownerName = ownership ? getOwnerName(ownership.player_id) : 'Unowned';
    const isOwned = ownership && ownership.player_id;

    return (
      <Card 
        className="mb-2 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setExpandedProperty(isExpanded ? null : property.id)}
      >
        <div className="flex items-stretch">
          {/* Full-height color bar */}
          <div 
            className="w-2 rounded-l"
            style={{ backgroundColor: colorStyle.bg }}
          />

          {/* Content area with extra padding so text doesn't touch the bar */}
          <div className="flex-1 p-3 pl-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{property.name}</div>
                <div className="text-sm text-muted-foreground">
                  ${property.price} • {ownerName}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {ownership && ownership.houses > 0 && (
                  <Badge variant="secondary">
                    {ownership.houses === 5 ? (
                      <><Building2 className="w-3 h-3 mr-1" />Hotel</>
                    ) : (
                      <><Home className="w-3 h-3 mr-1" />{ownership.houses}</>
                    )}
                  </Badge>
                )}
                {ownership?.is_mortgaged && (
                  <Badge variant="destructive">Mortgaged</Badge>
                )}
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>

            {isExpanded && (
              <div className="px-4 pb-4 border-t pt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                {/* Property details */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-muted-foreground">Purchase Price</div>
                    <div className="font-semibold">${property.price}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Mortgage Value</div>
                    <div className="font-semibold">${property.mortgageValue}</div>
                  </div>
                  {property.type === 'street' && (
                    <>
                      <div>
                        <div className="text-muted-foreground">Base Rent</div>
                        <div className="font-semibold">${property.rent}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">House Cost</div>
                        <div className="font-semibold">${property.houseCost}</div>
                      </div>
                    </>
                  )}
                  {property.type === 'railroad' && (
                    <div className="col-span-2">
                      <div className="text-muted-foreground">Rent</div>
                      <div className="text-xs">
                        1: ${property.rent} • 2: ${property.rentWithColorSet} • 
                        3: ${property.rent1House} • 4: ${property.rent2House}
                      </div>
                    </div>
                  )}
                  {property.type === 'utility' && (
                    <div className="col-span-2">
                      <div className="text-muted-foreground">Rent Multiplier</div>
                      <div className="text-xs">
                        1 utility: {property.rent}x dice • 2 utilities: {property.rentWithColorSet}x dice
                      </div>
                    </div>
                  )}
                </div>

                {/* Owner assignment */}
                <div>
                  <div className="text-sm font-semibold mb-2">Owner</div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={!isOwned ? "default" : "outline"}
                      onClick={() => assignProperty(property, null)}
                    >
                      Unowned
                    </Button>
                    {players.filter(p => !(p as any).is_bankrupt).map(player => (
                      <Button
                        key={player.id}
                        size="sm"
                        variant={ownership?.player_id === player.id ? "default" : "outline"}
                        onClick={() => assignProperty(property, player.id)}
                      >
                        {player.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Houses/Hotels (only for streets) */}
                {property.type === 'street' && ownership && ownership.player_id && (
                  <div>
                    <div className="text-sm font-semibold mb-2">Houses/Hotel</div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateHouses(property, -1)}
                        disabled={ownership.houses === 0 || ownership.is_mortgaged}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <div className="px-4 py-2 bg-muted rounded text-center min-w-[100px]">
                        {ownership.houses === 5 ? (
                          <div className="flex items-center justify-center gap-1">
                            <Building2 className="w-4 h-4" />
                            <span>Hotel</span>
                          </div>
                        ) : ownership.houses === 0 ? (
                          <span>No houses</span>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <Home className="w-4 h-4" />
                            <span>{ownership.houses}</span>
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateHouses(property, 1)}
                        disabled={ownership.houses === 5 || ownership.is_mortgaged}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Mortgage toggle */}
                {ownership && ownership.player_id && (
                  <Button
                    size="sm"
                    variant={ownership.is_mortgaged ? "destructive" : "outline"}
                    className="w-full"
                    onClick={() => toggleMortgage(property)}
                  >
                    {ownership.is_mortgaged ? 'Unmortgage' : 'Mortgage'} (${property.mortgageValue})
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  const groupedProperties = getPropertiesByColor();
  const colorOrder: PropertyColor[] = [
    'brown', 'light-blue', 'pink', 'orange', 
    'red', 'yellow', 'green', 'dark-blue', 
    'railroad', 'utility'
  ];

  const rankings = calculateRankings();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            Properties Manager
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="properties">
              <Building2 className="w-4 h-4 mr-2" />
              Properties
            </TabsTrigger>
            <TabsTrigger value="rankings">
              <TrendingUp className="w-4 h-4 mr-2" />
              Rankings
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="properties" className="mt-4 space-y-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading properties...</div>
            ) : (
                (() => {
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-medium">Filter</div>
                        <select
                          value={filterOwner}
                          onChange={(e) => setFilterOwner(e.target.value)}
                          className="px-2 py-1 border rounded bg-background text-sm"
                          aria-label="Filter properties by owner"
                        >
                          <option value="all">All</option>
                          <option value="unowned">Unowned</option>
                          {players.filter(p => !(p as any).is_bankrupt).map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>

                      {(() => {
                        const orderedProps: MonopolyProperty[] = [];
                        colorOrder.forEach(color => {
                          const props = (groupedProperties[color] || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
                          props.forEach(p => {
                            const ownership = getOwnership(p.id);
                            const ownerId = ownership?.player_id ?? null;
                            if (filterOwner === 'all') {
                              orderedProps.push(p);
                            } else if (filterOwner === 'unowned') {
                              if (!ownerId) orderedProps.push(p);
                            } else {
                              if (ownerId === filterOwner) orderedProps.push(p);
                            }
                          });
                        });
                        return orderedProps.map(property => (
                          <PropertyCard key={property.id} property={property} />
                        ));
                      })()}
                    </div>
                  );
                })()
              )}
          </TabsContent>
          
          <TabsContent value="rankings" className="mt-4">
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground mb-4">
                Advanced win probability based on assets, strategy, game phase, and luck factors
              </div>
              
              {(() => {
                // Merge rankings with win probabilities
                const rankings = calculateRankings();
                const rankedWithProbs = rankings.map(rank => {
                  const prob = winProbabilities.find(p => p.playerId === rank.player.id);
                  return {
                    ...rank,
                    winProbability: prob?.winProbability || 0,
                    breakdown: prob?.breakdown
                  };
                }).sort((a, b) => b.winProbability - a.winProbability);
                
                return rankedWithProbs.map((rank, index) => (
                  <Card key={rank.player.id} className="p-4">
                    <div className="space-y-3">
                      {/* Header Row */}
                      <div className="flex items-center gap-3">
                        <div className="text-2xl font-bold text-muted-foreground w-8">
                          #{index + 1}
                        </div>
                        {index === 0 && <Crown className="w-5 h-5 text-yellow-500" />}
                        
                        <div className="flex-1">
                          <div className="font-semibold text-lg">{rank.player.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {rank.propertyCount} propert{rank.propertyCount !== 1 ? 'ies' : 'y'}
                            {gameInfo?.sips_enabled && rank.player.total_sips ? 
                              ` • ${rank.player.total_sips} sips` : ''}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          {/* Win Probability - Large and Prominent */}
                          <div className="text-3xl font-bold text-primary flex items-center gap-2">
                            {rank.winProbability > 0 ? (
                              <>
                                {rank.winProbability.toFixed(1)}%
                                {rank.winProbability > 50 && <Zap className="w-6 h-6 text-yellow-500" />}
                              </>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Win Probability
                          </div>
                        </div>
                      </div>
                      
                      {/* Asset Breakdown */}
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                        <div>
                          <div className="text-xs text-muted-foreground">Total Value</div>
                          <div className="text-lg font-semibold">
                            ${rank.totalValue.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Cash</div>
                          <div className="text-lg font-semibold">
                            ${rank.balance.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Properties</div>
                          <div className="text-lg font-semibold">
                            ${rank.propertyValue.toLocaleString()}
                          </div>
                        </div>
                        {rank.breakdown && (
                          <div>
                            <div className="text-xs text-muted-foreground">Strategy Score</div>
                            <div className="text-lg font-semibold">
                              {rank.breakdown.strategyScore.toFixed(0)}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Detailed Breakdown (if available) */}
                      {rank.breakdown && (
                        <div className="pt-3 border-t">
                          <div className="text-xs font-semibold mb-2 text-muted-foreground">Score Breakdown</div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Assets:</span>
                              <span className="font-medium">{rank.breakdown.assetScore.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Strategy:</span>
                              <span className="font-medium">{rank.breakdown.strategyScore.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Luck:</span>
                              <span className={`font-medium ${rank.breakdown.luckScore >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {rank.breakdown.luckScore >= 0 ? '+' : ''}{rank.breakdown.luckScore.toFixed(0)}
                              </span>
                            </div>
                            {gameInfo?.sips_enabled && rank.breakdown.sipPenalty !== 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Sip Penalty:</span>
                                <span className="font-medium text-orange-600">
                                  {rank.breakdown.sipPenalty.toFixed(0)}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Game Phase:</span>
                              <span className="font-medium">
                                {rank.breakdown.gamePhaseScore === 0 ? 'Early' :
                                 rank.breakdown.gamePhaseScore === 1 ? 'Mid' : 'Late'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Win Probability Bar */}
                      <div className="pt-2">
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-green-500 transition-all duration-500"
                            style={{ width: `${Math.max(2, Math.min(100, rank.winProbability || 0))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                ));
              })()}
              
              {winProbabilities.length === 0 && !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  No players in the game yet
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default PropertiesPopup;
