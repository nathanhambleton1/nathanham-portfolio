import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { DollarSign } from "lucide-react";
import CardHand from "./CardHand";

interface BlackjackPlayer {
  id: string;
  name: string;
  is_dealer: boolean;
  balance: number;
  has_placed_bet: boolean;
  current_bet: number;
  is_online: boolean;
}

interface BlackjackHand {
  id: string;
  player_id: string;
  cards: string[];
  bet_amount: number;
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
}: DealerGameViewProps) => {
  const nonDealerPlayers = players.filter(p => !p.is_dealer);
  const anyBetsPlaced = nonDealerPlayers.some(p => p.has_placed_bet);
  
  // Find the player whose turn it is
  const activeHand = hands.find(h => h.is_active && h.status === 'active');
  const activePlayer = activeHand ? players.find(p => p.id === activeHand.player_id) : null;

  // Compute dealer net payout for this round based on players' hand results
  const dealerNet = nonDealerPlayers.reduce((acc, p) => {
    const ph = hands.find(h => h.player_id === p.id);
    if (!ph || !ph.result) return acc;

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
    return acc;
  }, 0 as number);

  return (
    <div className="min-h-screen bg-gradient-bg flex flex-col">
      {/* Top Bar */}
      <div className="p-4 border-b bg-card/50 backdrop-blur">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h2 className="text-xl font-bold">Dealer View</h2>
          <div className="flex gap-2 items-center">
            <Badge variant={gameStatus === 'betting' ? 'default' : 'secondary'}>
              {gameStatus.toUpperCase()}
            </Badge>
            {activePlayer && gameStatus === 'playing' && (
              <Badge variant="outline" className="bg-red-500 text-white animate-pulse">
                Turn: {activePlayer.name}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Dealer's Hand - Large and Centered */}
          <div className="flex justify-center">
            <CardHand
              cards={dealerHand}
              label="Dealer Hand"
              value={dealerHand.length > 0 ? dealerValue : undefined}
              soft={dealerSoft}
              large={true}
              animateNewCards={gameStatus === 'dealer_turn'}
            />
          </div>

          {/* Action / Status Box (moved above player cards) */}
          <div className="p-4 border-t bg-card/50 backdrop-blur">
            <div className="max-w-7xl mx-auto flex flex-col gap-2">
              {/* Dealer payout shown here */}
              <div className="flex items-center justify-center gap-3">
                <div className="text-sm text-muted-foreground">Dealer Payout</div>
                <div className={`text-lg font-bold ${dealerNet > 0 ? 'text-green-600' : (dealerNet < 0 ? 'text-red-600' : 'text-muted-foreground')}`}>
                  {dealerNet > 0 ? `+$${dealerNet}` : (dealerNet < 0 ? `-$${Math.abs(dealerNet)}` : '$0')}
                </div>
              </div>

              {gameStatus === 'betting' && anyBetsPlaced && (
                <Button 
                  onClick={onDealCards} 
                  className="w-full" 
                  size="lg"
                  disabled={loading}
                >
                  Deal Cards
                </Button>
              )}
              
              {gameStatus === 'betting' && !anyBetsPlaced && (
                <div className="text-center text-muted-foreground">
                  Waiting for players to place bets...
                </div>
              )}

              {['playing', 'dealer_turn', 'resolving'].includes(gameStatus) && (
                <div className="text-center text-muted-foreground">
                  Round in progress...
                </div>
              )}

              {gameStatus === 'table_idle' && (
                <div className="flex flex-col gap-2">
                  <Button 
                    onClick={onStartBetting} 
                    className="w-full" 
                    size="lg"
                  >
                    Start Next Round
                  </Button>
                  <div className="flex gap-2">
                    <Button 
                      onClick={onBackToLobby} 
                      variant="outline"
                      className="flex-1"
                    >
                      Local Lobby
                    </Button>
                    {onForceLobby && (
                      <Button 
                        onClick={onForceLobby} 
                        variant="destructive"
                        className="flex-1"
                      >
                        Force All to Lobby
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {gameStatus === 'lobby' && (
                <div className="flex flex-col gap-2">
                  <div className="text-center text-muted-foreground">Waiting in lobby...</div>
                  {onBackToLobby && (
                    <Button className="w-full" onClick={onBackToLobby} variant="outline">Back to Lobby Screen</Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Chip Requests */}
          {chipRequests.length > 0 && (
            <Card className="border-yellow-500">
              <CardHeader>
                <CardTitle className="text-lg">Pending Chip Requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {chipRequests.map((req) => {
                  const player = players.find(p => p.id === req.player_id);
                  return (
                    <div key={req.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <div className="font-semibold">{player?.name}</div>
                        <div className="text-sm text-muted-foreground">${req.amount}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => onApproveChipRequest(req.id, true)}>
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => onApproveChipRequest(req.id, false)}>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nonDealerPlayers.map((player) => {
              const playerHand = hands.find(h => h.player_id === player.id);
              const handValue = playerHand ? calculateHandValue(playerHand.cards) : null;
              const isPlayersTurn = playerHand?.is_active && playerHand?.status === 'active';
              const isWin = playerHand?.result === 'win' || playerHand?.result === 'blackjack';
              const isLoss = playerHand?.result === 'loss';

              // Compute displayed payout per player: losses shown as negative bet amount
              const displayPayout = playerHand
                ? (isLoss ? -(playerHand.bet_amount ?? 0) : (playerHand.payout ?? 0))
                : 0;

              const payoutClass = displayPayout > 0 ? 'text-green-600' : 'text-red-600';

              // Card border: active player's box is red; winning players get green border
              // Determine border based on state priority and actual bet value:
              // 1) active player's turn -> strong red
              // 2) winning -> green
              // 3) bet placed (current_bet > 0 or has_placed_bet) -> green outline
              // 4) no bet -> red dashed outline
              const hasBet = (player.current_bet && player.current_bet > 0) || player.has_placed_bet;
              let cardClass = 'border border-muted';
              if (isPlayersTurn) {
                cardClass = '!border-4 !border-red-600 !border-solid';
              } else if (isWin) {
                cardClass = '!border-2 !border-green-600';
              } else if (hasBet) {
                cardClass = '!border-2 !border-green-500';
              } else {
                cardClass = '!border-2 !border-red-500 border-dashed';
              }

              const cardStyle = isPlayersTurn ? { borderColor: '#dc2626', borderWidth: 4, borderStyle: 'solid' } : {};

              return (
                <Card 
                  key={player.id} 
                  className={cardClass}
                  style={cardStyle}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {player.name}
                      </CardTitle>
                      <Badge variant={player.is_online ? 'default' : 'secondary'}>
                        {player.is_online ? 'Online' : 'Offline'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div>Balance: ${player.balance}</div>
                      {player.current_bet > 0 && <div>Bet: ${player.current_bet}</div>}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {playerHand && playerHand.cards.length > 0 ? (
                      <div className="flex justify-center">
                        <CardHand
                          cards={playerHand.cards}
                          value={handValue?.value}
                          soft={handValue?.soft}
                          animateNewCards={true}
                        />
                      </div>
                    ) : player.has_placed_bet ? (
                      <div className="text-center text-muted-foreground py-8">
                        Waiting for cards...
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        No bet placed
                      </div>
                    )}
                    
                    {playerHand?.result && (
                      <div className="mt-3 flex items-center justify-center gap-2">
                        <div className="text-sm text-muted-foreground">Payout</div>
                        <div className={`text-lg font-bold ${payoutClass}`}>
                          {displayPayout > 0 ? `+$${displayPayout}` : (displayPayout < 0 ? `-$${Math.abs(displayPayout)}` : '$0')}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Action Bar removed (moved above player cards) */}
    </div>
  );
};

export default DealerGameView;
