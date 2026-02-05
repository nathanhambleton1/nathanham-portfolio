import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { useEffect, useState } from 'react';
import CardHand from "./CardHand";
import { BASE_HEIGHT_FOR_SCALE, SCALE_SENSITIVITY } from './cardConfig';
import DeckMeter from "./DeckMeter";

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
  deckRemaining: number;
  deckTotal: number;
  deckThresholdPercent: number;
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
  deckRemaining,
  deckTotal,
  deckThresholdPercent,
}: PlayerGameViewProps) => {
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  // Loader mount/visibility state so we can fade it out on gameStatus change
  const [loaderMounted, setLoaderMounted] = useState(false);
  const [loaderVisible, setLoaderVisible] = useState(false);

  useEffect(() => {
    let timeout: number | undefined;

    // Show loader for the entire betting phase (regardless of whether the player has placed a bet)
    if (gameStatus === 'betting') {
      // Mount and fade in
      setLoaderMounted(true);
      requestAnimationFrame(() => setLoaderVisible(true));
    } else if (loaderMounted) {
      // Fade out then unmount
      setLoaderVisible(false);
      timeout = window.setTimeout(() => setLoaderMounted(false), 300);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [gameStatus]);

  // If cards start dealing (player or dealer cards appear) hide the loader immediately
  useEffect(() => {
    if (loaderMounted && ((myHand && myHand.cards.length > 0) || (dealerHand && dealerHand.length > 0))) {
      setLoaderVisible(false);
      const t = window.setTimeout(() => setLoaderMounted(false), 200);
      return () => clearTimeout(t);
    }
  }, [loaderMounted, myHand?.cards.length, dealerHand.length]);

  // Card scale based on screen height
  const [cardScale, setCardScale] = useState(1);

  useEffect(() => {
    const updateCardScale = () => {
      const height = window.innerHeight;
      const ratio = height / BASE_HEIGHT_FOR_SCALE;
      const scaled = Math.min(1, Math.pow(ratio, SCALE_SENSITIVITY));
      setCardScale(scaled);
    };

    updateCardScale();
    window.addEventListener('resize', updateCardScale);
    return () => window.removeEventListener('resize', updateCardScale);
  }, []);

  const dealerDisplayCards = showFullDealerHand
    ? dealerHand
    : (() => {
        // Show dealer cards as they arrive during dealing
        // First card shows immediately, second card shows as __HIDDEN__
        if (dealerHand && dealerHand.length >= 2) return dealerHand;
        if (dealerHand && dealerHand.length === 1) return [dealerHand[0]];
        return [];
      })();
  // const dealerValue = showFullDealerHand ? calculateHandValue(dealerHand) : null;

  // Check if it's this player's turn
  const isMyTurn = gameStatus === 'playing' && myHand?.is_active && myHand.status === 'active';

  return (
    <div
      className="flex-1 h-screen flex flex-col transition-all overflow-hidden bg-gradient-bg"
      style={{ maxHeight: '100vh', overflow: 'hidden' }}
    >
      {/* Main Game Area - content with increased top padding (inline style) */}
      <div className="flex-1 flex flex-col items-center min-h-0 relative max-h-full" style={{ paddingTop: '2rem' }}>

        {/* Loading GIF overlay centered vertically between header bottom and footer top */}
        {loaderMounted && (
          <div
            className={`absolute inset-0 flex items-center justify-center z-30 transition-opacity duration-300 pointer-events-none ${loaderVisible ? 'opacity-100' : 'opacity-0'}`}
            style={{ background: 'rgba(0,0,0,0.15)', transform: 'translateY(-8rem)' }}
          >
            <img
              src="/black_jack_loading.gif"
              alt="Loading..."
              className="w-36 h-36 object-contain"
              style={{ filter: 'drop-shadow(0 0 8px #0008)' }}
            />
          </div>
        )}

        <div 
          className="relative w-full max-w-4xl flex flex-col items-center gap-1 transition-transform duration-300 overflow-hidden max-h-[calc(100vh-140px)]"
          style={{ 
            transform: 'scale(min(1, (100vh - 240px) / 480))',
            transformOrigin: 'top center',
            paddingBottom: '6rem'
          }}
        >
           {/* Dealer Hand - Top (reserve space even before cards are dealt) */}
           <div className="flex justify-center origin-center">
             <CardHand
               cards={dealerDisplayCards}
               label="Dealer"
               // value and soft removed to hide hand value
               scale={cardScale}
               animateNewCards={true}
               showEmptySlot={true}
             />
           </div>

           {/* Player's Hand - Center */}
           {myHand && myHand.cards.length > 0 && (
             <div className="flex justify-center origin-center">
               <CardHand
                 cards={myHand.cards}
                 label="Your Hand"
                 // value and soft removed to hide hand value
                 scale={cardScale}
                 animateNewCards={true}
               />
             </div>
           )}

           {/* Result Display */}
           {myHand?.result && (
             <div className="flex justify-center w-full">
               <Card className="w-full max-w-xs shadow-lg bg-card/90">
                 <CardContent className="p-3">
                   <div className={`text-center text-2xl font-black ${myHand.result === 'win' ? 'text-green-600' : myHand.result === 'loss' ? 'text-red-600' : 'text-white'}`}>{
                     myHand.payout > 0
                       ? `+$${myHand.payout}`
                       : myHand.payout < 0
                         ? `-$${Math.abs(myHand.payout)}`
                         : (myHand.result === 'loss' ? `-$${myHand.bet_amount}` : '$0')
                   }</div>
                 </CardContent>
               </Card>
             </div>
           )}
         </div>
      </div>

      {/* Bottom Action Bar - Always at bottom via flex */}
      <div
        className="w-full border-t bg-card/60 backdrop-blur-md p-1 fixed left-0 right-0 z-20"
        style={{ bottom: '1.5rem', paddingBottom: 'calc(0.25rem + env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-4xl mx-auto">
          {/* Player Info */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              {player.current_bet > 0 && (
                <Badge variant="secondary" className="font-mono">BET: ${player.current_bet}</Badge>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center mb-4">
            <DeckMeter
              remaining={deckRemaining}
              total={deckTotal}
              thresholdPercent={deckThresholdPercent}
              size={52}
              strokeWidth={5}
              label="Shoe"
              showStatusText={true}
            />
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
                <Button
                  className="w-full"
                  onClick={onBackToLobby}
                  variant="outline"
                  style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
                >
                  Back to Lobby
                </Button>
              )}
            </div>
          )}
        </div>
        {/* spacer for iPhone safe-area (home indicator / search bar) */}
        <div style={{ height: 'env(safe-area-inset-bottom)' }} />
      </div>
    </div>
  );
};

export default PlayerGameView;
