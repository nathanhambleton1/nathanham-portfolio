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
  hand_index: number;
  cards: string[];
  bet_amount: number;
  insurance_bet: number;
  status: string;
  is_active: boolean;
  result: string | null;
  payout: number;
}

interface PlayerGameViewProps {
  player: BlackjackPlayer;
  myHands: BlackjackHand[];
  activeHand: BlackjackHand | undefined;
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
  splitEnabled: boolean;
  canSplit: boolean;
  onSplit: () => void;
  showInsurancePrompt: boolean;
  insuranceAmount: number;
  insuranceDecision: 'taken' | 'declined' | undefined;
  onInsuranceDecision: (takeInsurance: boolean) => void;
  onBackToLobby?: () => void;
  deckRemaining: number;
  deckTotal: number;
  deckThresholdPercent: number;
}

const PlayerGameView = ({
  player,
  myHands,
  activeHand,
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
  splitEnabled,
  canSplit,
  onSplit,
  showInsurancePrompt,
  insuranceAmount,
  insuranceDecision,
  onInsuranceDecision,
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
    if (loaderMounted && ((myHands && myHands.some(h => h.cards.length > 0)) || (dealerHand && dealerHand.length > 0))) {
      setLoaderVisible(false);
      const t = window.setTimeout(() => setLoaderMounted(false), 200);
      return () => clearTimeout(t);
    }
  }, [loaderMounted, myHands, dealerHand.length]);

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
  const dealerBlackjack = dealerHand.length === 2 && calculateHandValue(dealerHand).value === 21;

  const sortedHands = [...(myHands || [])].sort((a, b) => a.hand_index - b.hand_index);
  const insuranceHand = sortedHands.find(h => h.hand_index === 0);
  const insuranceBet = insuranceHand?.insurance_bet ?? 0;
  const hasActiveHand = sortedHands.some(h => h.status === 'active');
  const allHandsComplete = sortedHands.length > 0
    && sortedHands.every(h => ['stood', 'busted', 'doubled', 'blackjack'].includes(h.status));

  // Check if it's this player's turn
  const isMyTurn = gameStatus === 'playing' && activeHand?.is_active && activeHand.status === 'active';

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
               label={loaderMounted ? undefined : "Dealer"}
               // value and soft removed to hide hand value
               scale={cardScale}
               animateNewCards={true}
               showEmptySlot={!loaderMounted}
             />
           </div>

           {/* Player Hands - Center */}
           {sortedHands.length > 0 ? (
             <div className="flex flex-wrap justify-center gap-4">
               {sortedHands.map((hand) => {
                 const isActive = hand.is_active && hand.status === 'active';
                 const isTurnHighlight = isMyTurn && isActive;
                 const isWin = hand.result === 'win' || hand.result === 'blackjack';
                 const isLoss = hand.result === 'loss';
                 const isPush = hand.result === 'push';
                 const isBusted = hand.status === 'busted';
                 const payoutDisplay = hand.payout > 0
                   ? `+$${hand.payout}`
                   : hand.payout < 0
                     ? `-$${Math.abs(hand.payout)}`
                     : (hand.result === 'loss' ? `-$${hand.bet_amount}` : '$0');
                 const payoutClass = hand.result === 'win' || hand.result === 'blackjack'
                   ? 'text-green-600'
                   : hand.result === 'loss'
                     ? 'text-red-600'
                     : 'text-white';

                 const borderStateClass = isTurnHighlight
                   ? 'border-red-500'
                   : isWin
                     ? 'border-green-500'
                     : (isLoss || isBusted)
                       ? 'border-red-500'
                       : isPush
                         ? 'border-border/80'
                         : 'border-border/60';

                 const pulseBorderClass = isTurnHighlight
                   ? "relative after:content-[''] after:absolute after:inset-0 after:rounded-xl after:border-2 after:border-red-500 after:animate-pulse after:pointer-events-none"
                   : '';

                 const handClass = [
                   'rounded-xl border bg-card/70 px-3 py-2 shadow-sm transition-all duration-300',
                   borderStateClass,
                   pulseBorderClass
                 ].filter(Boolean).join(' ');

                 return (
                   <div
                     key={hand.id}
                     className={handClass}
                   >
                     <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span className="w-full text-center text-xs text-muted-foreground">
                        {sortedHands.length > 1 ? `Hand ${hand.hand_index + 1}` : 'YOUR HAND'}
                      </span>
                     </div>
                    <CardHand
                      cards={hand.cards}
                      label={undefined}
                      // value and soft removed to hide hand value
                      scale={cardScale}
                      animateNewCards={true}
                    />
                    {hand.insurance_bet > 0 && dealerHand.length >= 2 && (
                      <div className={`mt-1 text-center text-xs font-semibold ${
                        dealerBlackjack ? 'text-green-500' : 'text-red-500'
                      }`}>
                        Insurance {dealerBlackjack ? `+$${hand.insurance_bet * 2}` : `-$${hand.insurance_bet}`}
                      </div>
                    )}
                    {hand.result && (
                      <div className={`mt-2 text-center text-lg font-black ${payoutClass}`}>
                        {payoutDisplay}
                      </div>
                    )}
                   </div>
                 );
               })}
             </div>
           ) : gameStatus !== 'betting' ? (
             <div className="flex justify-center">
               <div className="rounded-xl border bg-card/70 px-3 py-2 shadow-sm border-border/60">
                 <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                     <span className="w-full text-center block">YOUR HAND</span>
                 </div>
                 <CardHand
                   cards={[]}
                   label={undefined}
                   scale={cardScale}
                   animateNewCards={false}
                   showEmptySlot={true}
                 />
               </div>
             </div>
           ) : null}
         </div>
      </div>

      {/* Deck Meter - Floating under header */}
      <div
        className="absolute left-4 z-20"
        style={{ top: 'calc(4rem + 1rem)' }}
      >
        <DeckMeter
          remaining={deckRemaining}
          total={deckTotal}
          thresholdPercent={deckThresholdPercent}
          size={40}
          strokeWidth={4}
          label="Shoe"
          showStatusText={false}
          showDetails={false}
        />
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
              {insuranceBet > 0 && (
                <Badge variant="outline" className="font-mono">INSURANCE: ${insuranceBet}</Badge>
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

          {/* Insurance prompt */}
          {gameStatus === 'insurance' && (
            showInsurancePrompt ? (
              <div className="space-y-3">
                <div className="text-center text-lg font-semibold">
                  Insurance?
                </div>
                <div className="text-center text-sm text-muted-foreground">
                  Insurance pays 2:1 if the dealer has blackjack.
                </div>
                <div className="flex gap-3 justify-center flex-wrap">
                  <Button 
                    onClick={() => onInsuranceDecision(true)}
                    size="lg"
                    className="flex-1 max-w-[220px]"
                    disabled={insuranceAmount <= 0 || insuranceDecision === 'taken'}
                  >
                    Take Insurance ${insuranceAmount}
                  </Button>
                  <Button 
                    onClick={() => onInsuranceDecision(false)}
                    size="lg"
                    variant="secondary"
                    className="flex-1 max-w-[220px]"
                    disabled={insuranceDecision === 'declined'}
                  >
                    No Insurance
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-4">
                Waiting for insurance decisions...
              </div>
            )
          )}

          {/* Playing Actions */}
          {gameStatus === 'playing' && isMyTurn && (
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
              {splitEnabled && canSplit && (
                <Button 
                  onClick={onSplit}
                  size="lg"
                  variant="outline"
                  className="flex-1 max-w-[200px]"
                >
                  Split
                </Button>
              )}
              {doubleDownEnabled && canDoubleDown && (
                <Button 
                  onClick={onDoubleDown}
                  size="lg"
                  variant="outline"
                  className="flex-1 max-w-[200px]"
                  disabled={activeHand ? activeHand.bet_amount > player.balance : true}
                >
                  Double Down
                </Button>
              )}
            </div>
          )}

          {/* Waiting for turn */}
          {gameStatus === 'playing' && !isMyTurn && hasActiveHand && !allHandsComplete && (
            <div className="text-center text-muted-foreground py-4">
              Waiting for your turn...
            </div>
          )}

          {/* Hand complete */}
          {allHandsComplete && gameStatus !== 'table_idle' && gameStatus !== 'insurance' && (
            <div className="text-center text-muted-foreground py-4">
              Waiting for round to complete...
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
