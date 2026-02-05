import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { useEffect, useRef } from "react";
import CardHand from "./CardHand";
import DeckMeter from "./DeckMeter";

interface BlackjackPlayer {
  id: string;
  name: string;
  is_dealer: boolean;
  balance: number;
  buy_in_with_sips: boolean;
  sips_owed: number;
  has_placed_bet: boolean;
  current_bet: number;
  is_online: boolean;
}

interface BlackjackHand {
  id: string;
  player_id: string;
  hand_index: number;
  cards: string[];
  bet_amount: number;
  insurance_bet: number;
  status: string;
  is_active: boolean;
  result: string | null;
  payout: number;
}

interface DealerGameViewProps {
  dealerHand: string[];
  dealerValue: number;
  dealerSoft: boolean;
  dealerStatus: string;
  players: BlackjackPlayer[];
  hands: BlackjackHand[];
  gameStatus: string;
  chipRequests: any[];
  calculateHandValue: (cards: string[]) => { value: number; soft: boolean };
  onDealCards: () => void;
  onStartBetting: () => void;
  onApproveChipRequest: (requestId: string, approve: boolean) => void;
  onGiveChips: (playerId: string, amount: number) => void;
  loading: boolean;
  onBackToLobby?: () => void;
  onForceLobby?: () => void;
  deckRemaining: number;
  deckTotal: number;
  deckThresholdPercent: number;
  onReshuffle: () => void;
  chipsEnabled: boolean;
}

const DealerGameView = ({
  dealerHand,
  dealerValue,
  dealerSoft,
  dealerStatus,
  players,
  hands,
  gameStatus,
  chipRequests,
  calculateHandValue,
  onDealCards,
  onStartBetting,
  onApproveChipRequest,
  onGiveChips,
  loading,
  onBackToLobby,
  onForceLobby,
  deckRemaining,
  deckTotal,
  deckThresholdPercent,
  onReshuffle,
  chipsEnabled,
}: DealerGameViewProps) => {
  const nonDealerPlayers = players.filter(p => !p.is_dealer);
  const anyBetsPlaced = nonDealerPlayers.some(p => p.has_placed_bet);
  const allBetsPlaced = nonDealerPlayers.every(p => p.has_placed_bet);
  const hasDealtRef = useRef(false);
  
  useEffect(() => {
    if (gameStatus !== 'betting') {
      hasDealtRef.current = false;
    }
  }, [gameStatus]);
  
  useEffect(() => {
    if (gameStatus === 'betting' && allBetsPlaced && !hasDealtRef.current) {
      onDealCards();
      hasDealtRef.current = true;
    }
  }, [gameStatus, allBetsPlaced, onDealCards]);
  
  // Find the player whose turn it is
  const activeHand = hands.find(h => h.is_active && h.status === 'active');
  const activePlayer = activeHand ? players.find(p => p.id === activeHand.player_id) : null;
  const deckPercent = deckTotal > 0 ? (deckRemaining / deckTotal) * 100 : 0;
  const deckLow = deckPercent <= deckThresholdPercent;

  // Compute dealer net payout for this round based on players' hand results
  const dealerNet = hands
    .filter(h => nonDealerPlayers.some(p => p.id === h.player_id) && h.result)
    .reduce((acc, ph) => {
      const handPlayer = players.find(p => p.id === ph.player_id);
      const trackChipsForPlayer = chipsEnabled && !handPlayer?.buy_in_with_sips;
      if (!trackChipsForPlayer) return acc;
      // If player won (including blackjack), dealer loses the player's payout amount
      if (ph.result === 'win' || ph.result === 'blackjack') {
        acc -= (ph.payout ?? ph.bet_amount ?? 0);
      } else if (ph.result === 'loss') {
        // Player lost: dealer gains the player's bet amount
        acc += (ph.bet_amount ?? 0);
      } else if (ph.result === 'push') {
        // push = no change
      } else {
        // other cases (surrender, doubled, etc.) - use payout if present
        acc -= (ph.payout ?? 0);
      }

      if (ph.insurance_bet && ph.insurance_bet > 0) {
        acc += dealerStatus === 'blackjack' ? -ph.insurance_bet : ph.insurance_bet;
      }

      return acc;
    }, 0 as number);

  return (
    <div className="flex-1 h-full flex flex-col transition-all overflow-hidden bg-gradient-bg">
      {/* 1. Top Bar - Fixed Header Info */}
      <div className="flex-shrink-0 p-4 border-b bg-card/60 backdrop-blur-md z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Badge variant={gameStatus === 'betting' ? 'default' : 'secondary'} className="text-sm">
            Status: {gameStatus.toUpperCase()}
          </Badge>
          {activePlayer && gameStatus === 'playing' && (
            <Badge variant="outline" className="bg-red-500 text-white animate-pulse">
              Current Turn: {activePlayer.name}
            </Badge>
          )}
        </div>
      </div>

      {/* 2. Middle Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        <div className="max-w-7xl mx-auto space-y-6 pb-4">
          {/* Dealer's Hand - Top */}
          <div className="flex justify-center flex-shrink-0">
            <CardHand
              cards={dealerHand}
              label="Dealer Hand"
              value={dealerHand.length > 0 ? dealerValue : undefined}
              soft={dealerSoft}
              large={true}
              animateNewCards={gameStatus === 'dealer_turn'}
            />
          </div>

          {/* Chip Requests - High Visibility */}
          {chipsEnabled && chipRequests.length > 0 && (
            <Card className="border-yellow-500 bg-yellow-500/10">
              <CardHeader className="py-2">
                <CardTitle className="text-sm">Pending Chip Requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 py-2">
                {chipRequests.map((req) => {
                  const player = players.find(p => p.id === req.player_id);
                  return (
                    <div key={req.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <div className="text-xs">
                        <span className="font-bold">{player?.name}:</span> ${req.amount}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-[10px]" onClick={() => onApproveChipRequest(req.id, true)}>
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" className="h-7 text-[10px]" onClick={() => onApproveChipRequest(req.id, false)}>
                          Deny
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Player Hands Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {nonDealerPlayers.map((player) => {
              const playerHands = hands
                .filter(h => h.player_id === player.id)
                .sort((a, b) => a.hand_index - b.hand_index);
              const isPlayersTurn = playerHands.some(h => h.is_active && h.status === 'active');
              const playerUsesChips = chipsEnabled && !player.buy_in_with_sips;
              const balanceLabel = playerUsesChips
                ? `$${player.balance}`
                : (player.buy_in_with_sips ? `Sips Owed: ${player.sips_owed || 0}` : 'Cards only');
              const formatDelta = (value: number) => {
                if (value === 0) {
                  return playerUsesChips ? '$0' : '0';
                }
                const abs = Math.abs(value);
                const unit = playerUsesChips ? `$${abs}` : (player.buy_in_with_sips ? `${abs} sips` : `${abs}`);
                return value > 0 ? `+${unit}` : `-${unit}`;
              };

              const hasBet = (player.current_bet && player.current_bet > 0) || player.has_placed_bet;
              let cardClass = 'border transition-all duration-300';
              if (isPlayersTurn) {
                cardClass += ' border-red-600 border-4 shadow-xl shadow-red-500/20';
              } else if (hasBet) {
                cardClass += ' border-green-500/50 border-2';
              } else {
                cardClass += ' border-red-500/30 border-dashed border-2';
              }

              return (
                <Card 
                  key={player.id} 
                  className={cardClass}
                >
                  <CardHeader className="p-3 pb-1">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold truncate pr-2">
                        {player.name}
                      </CardTitle>
                      <div
                        className={`w-3 h-3 rounded-full border-2
                          ${gameStatus === 'betting'
                            ? (player.has_placed_bet === true
                                ? 'bg-green-500 border-green-600'
                                : 'bg-red-500 border-red-600')
                            : (player.is_online
                                ? 'bg-green-500 border-green-600'
                                : 'bg-gray-400 border-gray-500')}
                        `}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                      <div>{balanceLabel}</div>
                      {player.current_bet > 0 && (
                        <Badge variant="outline" className="h-4 px-1 text-[8px]">
                          BET: {playerUsesChips ? `$${player.current_bet}` : (player.buy_in_with_sips ? `${player.current_bet} sips` : player.current_bet)}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-3">
                    {playerHands.length > 0 ? (
                      <div className="space-y-3">
                        {playerHands.map((hand) => {
                          const handValue = calculateHandValue(hand.cards);
                          const isWin = hand.result === 'win' || hand.result === 'blackjack';
                          const isLoss = hand.result === 'loss';
                          const displayPayout = isWin
                            ? -(hand.payout ?? 0)
                            : isLoss
                              ? (hand.bet_amount ?? 0)
                              : 0;
                          const payoutClass = displayPayout > 0
                            ? 'text-green-600'
                            : displayPayout < 0
                              ? 'text-red-600'
                              : 'text-white';

                          return (
                            <div
                              key={hand.id}
                              className={`rounded-md border px-2 py-2 ${
                                hand.is_active && hand.status === 'active'
                                  ? 'border-red-600 border-2 shadow-md'
                                  : 'border-border/50'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                                <span>Hand {hand.hand_index + 1}</span>
                                <span>
                                  Bet {playerUsesChips ? `$${hand.bet_amount}` : (player.buy_in_with_sips ? `${hand.bet_amount} sips` : hand.bet_amount)}
                                </span>
                              </div>
                              {hand.cards.length > 0 ? (
                                <div className="flex justify-center scale-90 origin-top">
                                  <CardHand
                                    cards={hand.cards}
                                    value={handValue?.value}
                                    soft={handValue?.soft}
                                    animateNewCards={true}
                                  />
                                </div>
                              ) : (
                                <div className="text-center text-[10px] text-muted-foreground py-2 italic">
                                  Waiting for cards...
                                </div>
                              )}
                              {hand.result && (
                                <div className="mt-2 text-center">
                                  <div className={`text-base font-black ${payoutClass}`}>
                                    {formatDelta(displayPayout)}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center text-[10px] text-muted-foreground py-4 italic">
                        {player.has_placed_bet ? 'Waiting for cards...' : 'No bet placed'}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Fixed Bottom Bar - Action / Status Box */}
      <div className="flex-shrink-0 p-4 border-t bg-card/70 backdrop-blur-md shadow-lg z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col gap-2">
            {/* Dealer payout info */}
          {chipsEnabled && (
            <div className="flex items-center justify-center gap-3 py-1">
              <div className="text-xs font-bold uppercase tracking-widest opacity-70">Dealer Payout</div>
              <div className={`text-lg font-black ${dealerNet > 0 ? 'text-green-600' : dealerNet < 0 ? 'text-red-600' : 'text-white'}`}>
                {dealerNet > 0 ? `+$${dealerNet}` : (dealerNet < 0 ? `-$${Math.abs(dealerNet)}` : '$0')}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-card/60 p-3">
            <DeckMeter
              remaining={deckRemaining}
              total={deckTotal}
              thresholdPercent={deckThresholdPercent}
              size={56}
              strokeWidth={6}
              label="Shoe"
              showStatusText={true}
            />
            <div className="flex items-center gap-2">
              {deckLow && (
                <div className="text-[11px] text-red-400 font-semibold uppercase tracking-wider">
                  Reshuffle Recommended
                </div>
              )}
              <Button
                onClick={onReshuffle}
                variant="outline"
                size="sm"
                className="uppercase tracking-widest text-[11px]"
              >
                Reshuffle
              </Button>
            </div>
          </div>

            {gameStatus === 'betting' && anyBetsPlaced && !allBetsPlaced && (
              <Button 
                onClick={onDealCards} 
                className="w-full font-black uppercase tracking-widest" 
                size="lg"
                disabled={loading}
              >
                Deal Cards
              </Button>
            )}
            
            {gameStatus === 'betting' && !anyBetsPlaced && (
              <div className="text-center text-sm text-muted-foreground py-2 italic">
                Waiting for players to place bets...
              </div>
            )}

            {['insurance', 'playing', 'dealer_turn', 'resolving'].includes(gameStatus) && (
              <div className="text-center text-sm font-bold animate-pulse text-primary py-2 uppercase tracking-tighter">
                Round in progress...
              </div>
            )}

            {gameStatus === 'table_idle' && (
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={onStartBetting} 
                  className="w-full font-black uppercase tracking-widest" 
                  size="lg"
                >
                  Start Next Round
                </Button>
                <div className="flex gap-2">
                  <Button 
                    onClick={onBackToLobby} 
                    variant="outline"
                    className="flex-1 text-xs"
                  >
                    Lobby
                  </Button>
                  {onForceLobby && (
                    <Button 
                      onClick={onForceLobby} 
                      variant="destructive"
                      className="flex-1 text-xs"
                    >
                      Force All Lobby
                    </Button>
                  )}
                </div>
              </div>
            )}

            {gameStatus === 'lobby' && (
              <div className="flex flex-col gap-2">
                <div className="text-center text-sm text-muted-foreground py-2">Waiting in lobby...</div>
                {onBackToLobby && (
                  <Button className="w-full" onClick={onBackToLobby} variant="outline">Exit Game View</Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DealerGameView;
