import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import CardHand from "./CardHand";

interface BlackjackPlayer {
  id: string;
  name: string;
  is_dealer: boolean;
  balance: number;
  has_placed_bet: boolean;
  current_bet: number;
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

interface PlayerGameViewProps {
  player: BlackjackPlayer;
  myHand: BlackjackHand | undefined;
  dealerVisibleCard: string | null;
  dealerHand: string[];
  gameStatus: string;
  showFullDealerHand: boolean;
  selectedBet: number;
  setSelectedBet: (bet: number) => void;
  betIncrements: number[];
  calculateHandValue: (cards: string[]) => { value: number; soft: boolean };
  onPlaceBet: (amount: number) => void;
  onHit: () => void;
  onStand: () => void;
  onDoubleDown: () => void;
  doubleDownEnabled: boolean;
  canDoubleDown: boolean;
  onBackToLobby?: () => void;
}

const PlayerGameView = ({
  player,
  myHand,
  dealerVisibleCard,
  dealerHand,
  gameStatus,
  showFullDealerHand,
  selectedBet,
  setSelectedBet,
  betIncrements,
  calculateHandValue,
  onPlaceBet,
  onHit,
  onStand,
  onDoubleDown,
  doubleDownEnabled,
  canDoubleDown,
  onBackToLobby,
}: PlayerGameViewProps) => {
  const myHandValue = myHand ? calculateHandValue(myHand.cards) : null;
  const dealerDisplayCards = showFullDealerHand
    ? dealerHand
    : (dealerHand && dealerHand.length >= 2)
      ? (dealerVisibleCard ? [dealerVisibleCard, '__HIDDEN__'] : dealerHand)
      : (dealerVisibleCard ? [dealerVisibleCard] : []);
  const dealerValue = showFullDealerHand ? calculateHandValue(dealerHand) : null;

  // Check if it's this player's turn
  const isMyTurn = gameStatus === 'playing' && myHand?.is_active && myHand.status === 'active';

  return (
    <div
      className={`min-h-screen flex flex-col transition-all ${isMyTurn ? 'bg-red-600 text-white' : 'bg-gradient-bg'}`}
    >
      {/* Main Game Area */}
      <div className="flex-1 p-4 flex flex-col justify-center">
        {/* Turn Indicator Banner */}
        {/* Removed turn banner at user's request */}
        
        <div className="max-w-4xl mx-auto w-full space-y-8">
          {/* Dealer Hand - Top of screen */}
          <div className="flex justify-center">
            <CardHand
              cards={dealerDisplayCards}
              label="Dealer"
              value={showFullDealerHand ? dealerValue?.value : undefined}
              soft={dealerValue?.soft}
              large={true}
            />
          </div>

          {/* Player's Hand - Large and Centered */}
          {myHand && myHand.cards.length > 0 && (
            <div className="flex justify-center">
              <CardHand
                cards={myHand.cards}
                label="Your Hand"
                value={myHandValue?.value}
                soft={myHandValue?.soft}
                large={true}
                animateNewCards={true}
              />
            </div>
          )}

          {/* Result Display: Always show payout, negative bet if lost, green if >0, red if <=0 */}
          {myHand?.result && (
            <div className="flex justify-center">
              <Card className="w-full max-w-md">
                <CardContent className="pt-6">
                  <div className="text-center text-lg font-bold">
                    Payout: 
                    <span className={`ml-2 text-2xl font-bold ${myHand.payout > 0 ? 'text-green-600' : 'text-red-600'}`}>{
                      myHand.payout > 0
                        ? `+$${myHand.payout}`
                        : myHand.payout < 0
                          ? `-$${Math.abs(myHand.payout)}`
                          : (myHand.result === 'loss' ? `-$${myHand.bet_amount}` : '$0')
                    }</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="p-4 border-t bg-card/50 backdrop-blur">
        <div className="max-w-4xl mx-auto">
          {/* Player Info */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-semibold">{player.name}</div>
            <div className="flex items-center gap-4">
              <div>Balance: <span className="font-bold">${player.balance}</span></div>
              {player.current_bet > 0 && (
                <Badge>Bet: ${player.current_bet}</Badge>
              )}
            </div>
          </div>

          {/* Betting Interface */}
          {gameStatus === 'betting' && !player.has_placed_bet && (
            <div className="space-y-4">
              <div className="text-center text-lg font-semibold">
                Place Your Bet
              </div>
              <div className="flex gap-2 justify-center flex-wrap">
                {betIncrements.map((amount) => (
                  <Button
                    key={amount}
                    variant={selectedBet === amount ? 'default' : 'outline'}
                    onClick={() => setSelectedBet(amount)}
                    disabled={amount > player.balance}
                    className="min-w-[80px]"
                  >
                    ${amount}
                  </Button>
                ))}
              </div>
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => onPlaceBet(selectedBet)}
                disabled={selectedBet > player.balance || selectedBet === 0}
              >
                Bet ${selectedBet}
              </Button>
            </div>
          )}

          {/* Waiting for bet */}
          {gameStatus === 'betting' && player.has_placed_bet && (
            <div className="text-center text-muted-foreground py-4">
              Waiting for other players...
            </div>
          )}

          {/* Playing Actions */}
          {gameStatus === 'playing' && myHand?.is_active && myHand.status === 'active' && (
            <div className="flex gap-3 justify-center flex-wrap">
              <Button 
                onClick={onHit}
                size="lg"
                className="flex-1 max-w-[200px]"
              >
                Hit
              </Button>
              <Button 
                onClick={onStand}
                size="lg"
                variant="secondary"
                className="flex-1 max-w-[200px]"
              >
                Stand
              </Button>
              {doubleDownEnabled && canDoubleDown && (
                <Button 
                  onClick={onDoubleDown}
                  size="lg"
                  variant="outline"
                  className="flex-1 max-w-[200px]"
                  disabled={myHand.bet_amount > player.balance}
                >
                  Double Down
                </Button>
              )}
            </div>
          )}

          {/* Waiting for turn */}
          {gameStatus === 'playing' && myHand && !myHand.is_active && myHand.status === 'active' && (
            <div className="text-center text-muted-foreground py-4">
              Waiting for your turn...
            </div>
          )}

          {/* Hand complete */}
          {myHand && ['stood', 'busted', 'doubled', 'blackjack'].includes(myHand.status) && gameStatus !== 'table_idle' && (
            <div className="text-center text-muted-foreground py-4">
              {myHand.status === 'busted' && 'Busted! Waiting for round to complete...'}
              {['stood', 'doubled', 'blackjack'].includes(myHand.status) && 'Waiting for round to complete...'}
            </div>
          )}

          {/* Dealer's turn */}
          {['dealer_turn', 'resolving'].includes(gameStatus) && (
            <div className="text-center text-muted-foreground py-4">
              Dealer is playing...
            </div>
          )}

          {/* Lobby after a round */}
          {gameStatus === 'table_idle' && (
            <div className="flex flex-col gap-2">
              <div className="text-center text-muted-foreground pb-4">Waiting for dealer to start next round...</div>
              {onBackToLobby && (
                <Button className="w-full" onClick={onBackToLobby} variant="outline">Back to Lobby</Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerGameView;
