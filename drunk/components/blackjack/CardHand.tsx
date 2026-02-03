import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import PlayingCard from "./PlayingCard";
import { BASE_HEIGHT, BASE_WIDTH, LARGE_SCALE, OVERLAP_SPACING } from './cardConfig';

interface CardHandProps {
  cards: string[];
  label?: string;
  value?: number;
  soft?: boolean;
  className?: string;
  large?: boolean;
  animateNewCards?: boolean;
}

const CardHand = ({ 
  cards, 
  label, 
  value, 
  soft, 
  className,
  large = false,
  animateNewCards = false
}: CardHandProps) => {
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {label && (
        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </div>
      )}
      
      {/* Cards */}
      <div
        className="relative flex items-center justify-center"
        style={{ minHeight: `${BASE_HEIGHT * (large ? LARGE_SCALE : 1) + 24}px`,
                 // compute the width of the whole hand so absolute-positioned cards
                 // are contained and the group can be centered by the parent
                 width: `${Math.max(0, ((cards.length - 1) * (OVERLAP_SPACING * (large ? LARGE_SCALE : 1))) + (BASE_WIDTH * (large ? LARGE_SCALE : 1)))}px`
        }}
      >
        {cards.map((card, idx) => {
          const scale = large ? LARGE_SCALE : 1;
          const left = idx * (OVERLAP_SPACING * scale);
          return (
          <div
            key={`${card}-${idx}`}
            className="absolute transition-all duration-300"
            style={{
              left: `${left}px`,
              top: '50%',
              zIndex: idx,
              transform: `translateY(-50%) rotate(${(idx - (cards.length - 1) / 2) * 3}deg)`,
            }}
          >
            <PlayingCard
              card={card}
              scale={scale}
              animateIn={animateNewCards && idx === cards.length - 1}
              delay={idx * 0.15}
            />
          </div>
        )})}
      </div>

      {/* Hand value */}
      {value !== undefined && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-lg font-bold"
        >
          {value === 21 && cards.length === 2 ? (
            <span className="text-yellow-500">BLACKJACK!</span>
          ) : value > 21 ? (
            <span className="text-destructive">BUST ({value})</span>
          ) : (
            <span>
              {value} {soft && <span className="text-xs text-muted-foreground">(soft)</span>}
            </span>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default CardHand;
