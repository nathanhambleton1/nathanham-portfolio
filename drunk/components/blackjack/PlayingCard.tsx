import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

import { BASE_WIDTH, BASE_HEIGHT, BACK_IMAGE_SRC, BACK_IMAGE_SCALE, BACK_IMAGE_OFFSET_X, BACK_IMAGE_OFFSET_Y } from './cardConfig';

interface PlayingCardProps {
  card: string;
  hidden?: boolean;
  className?: string;
  animateIn?: boolean;
  delay?: number;
  scale?: number; // multiply base size by this
  backImageSrc?: string; // URL for the back image
  backImageScale?: number; // multiplier for the back image inside the card
  backImageOffsetX?: number; // px offset for back image
  backImageOffsetY?: number; // px offset for back image
}

const PlayingCard = ({
  card,
  hidden = false,
  className,
  animateIn = false,
  delay = 0,
  scale = 1,
  backImageSrc = BACK_IMAGE_SRC,
  backImageScale = BACK_IMAGE_SCALE,
  backImageOffsetX = BACK_IMAGE_OFFSET_X,
  backImageOffsetY = BACK_IMAGE_OFFSET_Y
}: PlayingCardProps) => {

  const initialMotion = animateIn ? { scale: 0, rotateY: 180, x: -100, y: -100 } : false;
  const animateMotion = { scale: 1, rotateY: 0, x: 0, y: 0 };
  const transitionMotion = { 
    duration: 0.6, 
    delay,
    type: "spring",
    stiffness: 260,
    damping: 20
  };

  if (hidden || card === '__HIDDEN__') {
    return (
      <motion.div
        initial={initialMotion}
        animate={animateMotion}
        transition={transitionMotion}
        className={cn(
          "relative bg-gradient-to-br from-blue-900 to-blue-700",
          "rounded-lg shadow-xl border-2 border-white/20 overflow-hidden",
          "flex items-center justify-center",
          className
        )}
        style={{
          width: `${BASE_WIDTH * (scale ?? 1)}px`,
          height: `${BASE_HEIGHT * (scale ?? 1)}px`,
          minWidth: `${BASE_WIDTH * (scale ?? 1)}px`,
          minHeight: `${BASE_HEIGHT * (scale ?? 1)}px`
        }}
      >
        <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.05)_10px,rgba(255,255,255,0.05)_20px)] rounded-lg" />
        {/* Back image: centered and transformable; confined by overflow-hidden on the card */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <img
            src={backImageSrc}
            alt="card-back"
            style={{
              maxWidth: '92%',
              maxHeight: '92%',
              objectFit: 'contain',
              transform: `translate(${backImageOffsetX}px, ${backImageOffsetY}px) scale(${backImageScale})`,
              willChange: 'transform'
            }}
          />
        </div>
      </motion.div>
    );
  }

  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  
  const suitSymbols: Record<string, string> = {
    'S': '♠',
    'H': '♥',
    'D': '♦',
    'C': '♣'
  };
  
  const isRed = suit === 'H' || suit === 'D';
  const suitSymbol = suitSymbols[suit] || suit;
  
  // Determine layout for number cards
  const numericValue = parseInt(rank);
  const isNumberCard = !isNaN(numericValue) && numericValue >= 2 && numericValue <= 10;
  const isFaceCard = ['J', 'Q', 'K'].includes(rank);
  const isAce = rank === 'A';

  // Generate pip positions for number cards
  const getPipPositions = (value: number): { top: string; left: string }[] => {
    const positions: { top: string; left: string }[] = [];
    
    switch (value) {
      case 2:
        positions.push({ top: '20%', left: '50%' });
        positions.push({ top: '80%', left: '50%' });
        break;
      case 3:
        positions.push({ top: '20%', left: '50%' });
        positions.push({ top: '50%', left: '50%' });
        positions.push({ top: '80%', left: '50%' });
        break;
      case 4:
        positions.push({ top: '20%', left: '30%' });
        positions.push({ top: '20%', left: '70%' });
        positions.push({ top: '80%', left: '30%' });
        positions.push({ top: '80%', left: '70%' });
        break;
      case 5:
        positions.push({ top: '20%', left: '30%' });
        positions.push({ top: '20%', left: '70%' });
        positions.push({ top: '50%', left: '50%' });
        positions.push({ top: '80%', left: '30%' });
        positions.push({ top: '80%', left: '70%' });
        break;
      case 6:
        positions.push({ top: '20%', left: '30%' });
        positions.push({ top: '20%', left: '70%' });
        positions.push({ top: '50%', left: '30%' });
        positions.push({ top: '50%', left: '70%' });
        positions.push({ top: '80%', left: '30%' });
        positions.push({ top: '80%', left: '70%' });
        break;
      case 7:
        positions.push({ top: '20%', left: '30%' });
        positions.push({ top: '20%', left: '70%' });
        positions.push({ top: '35%', left: '50%' });
        positions.push({ top: '50%', left: '30%' });
        positions.push({ top: '50%', left: '70%' });
        positions.push({ top: '80%', left: '30%' });
        positions.push({ top: '80%', left: '70%' });
        break;
      case 8:
        positions.push({ top: '20%', left: '30%' });
        positions.push({ top: '20%', left: '70%' });
        positions.push({ top: '35%', left: '50%' });
        positions.push({ top: '50%', left: '30%' });
        positions.push({ top: '50%', left: '70%' });
        positions.push({ top: '65%', left: '50%' });
        positions.push({ top: '80%', left: '30%' });
        positions.push({ top: '80%', left: '70%' });
        break;
      case 9:
        positions.push({ top: '15%', left: '30%' });
        positions.push({ top: '15%', left: '70%' });
        positions.push({ top: '35%', left: '30%' });
        positions.push({ top: '35%', left: '70%' });
        positions.push({ top: '50%', left: '50%' });
        positions.push({ top: '65%', left: '30%' });
        positions.push({ top: '65%', left: '70%' });
        positions.push({ top: '85%', left: '30%' });
        positions.push({ top: '85%', left: '70%' });
        break;
      case 10:
        positions.push({ top: '15%', left: '30%' });
        positions.push({ top: '15%', left: '70%' });
        positions.push({ top: '30%', left: '50%' });
        positions.push({ top: '40%', left: '30%' });
        positions.push({ top: '40%', left: '70%' });
        positions.push({ top: '60%', left: '30%' });
        positions.push({ top: '60%', left: '70%' });
        positions.push({ top: '70%', left: '50%' });
        positions.push({ top: '85%', left: '30%' });
        positions.push({ top: '85%', left: '70%' });
        break;
    }
    
    return positions;
  };

  const cardContent = (
    <motion.div
      initial={initialMotion}
      animate={animateMotion}
      transition={transitionMotion}
      className={cn(
        "relative bg-white rounded-lg shadow-2xl border-2 border-gray-300 overflow-hidden",
        "flex flex-col",
        className
      )}
      style={{
        width: `${BASE_WIDTH * (scale ?? 1)}px`,
        height: `${BASE_HEIGHT * (scale ?? 1)}px`,
        minWidth: `${BASE_WIDTH * (scale ?? 1)}px`,
        minHeight: `${BASE_HEIGHT * (scale ?? 1)}px`
      }}
    >
      {/* Top corner */}
      <div className={cn(
        "absolute top-1 left-1.5 flex flex-col items-center leading-none",
        isRed ? "text-red-600" : "text-black"
      )}>
        <div className="text-base font-bold">{rank}</div>
        <div className="text-sm">{suitSymbol}</div>
      </div>

      {/* Bottom corner (rotated) */}
      <div className={cn(
        "absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180",
        isRed ? "text-red-600" : "text-black"
      )}>
        <div className="text-base font-bold">{rank}</div>
        <div className="text-sm">{suitSymbol}</div>
      </div>

      {/* Center content */}
      <div className="flex-1 flex items-center justify-center relative px-2 py-4">
        {isNumberCard && (
          <>
            {getPipPositions(numericValue).map((pos, idx) => (
              <div
                key={idx}
                className={cn(
                  "absolute text-3xl transform -translate-x-1/2 -translate-y-1/2",
                  isRed ? "text-red-600" : "text-black",
                  idx >= numericValue / 2 && "rotate-180"
                )}
                style={{ top: pos.top, left: pos.left }}
              >
                {suitSymbol}
              </div>
            ))}
          </>
        )}
        
        {isAce && (
          <div className={cn(
            "text-7xl leading-none",
            isRed ? "text-red-600" : "text-black"
          )}>
            {suitSymbol}
          </div>
        )}
        
        {isFaceCard && (
          <div className="flex flex-col items-center">
            <div className={cn(
              "text-6xl font-serif font-bold",
              isRed ? "text-red-600" : "text-black"
            )}>
              {rank}
            </div>
            <div className={cn(
              "text-4xl",
              isRed ? "text-red-600" : "text-black"
            )}>
              {suitSymbol}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );

  return cardContent;
};

export default PlayingCard;
