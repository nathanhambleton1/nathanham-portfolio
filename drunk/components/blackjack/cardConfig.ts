// Centralized card sizing configuration used by Blackjack card components.
// Change `BASE_WIDTH` and `BASE_HEIGHT` here to resize all cards.
export const BASE_WIDTH = 115; // px
export const BASE_HEIGHT = 165; // px
export const LARGE_SCALE = 1.25; // multiplier when 'large' is requested
export const OVERLAP_SPACING = 48; // px between stacked cards (base)

// Back image defaults (public/ path)
export const BACK_IMAGE_SRC = '/card.png';
export const BACK_IMAGE_SCALE = 3; // multiplier for the back image
export const BACK_IMAGE_OFFSET_X = 0; // px
export const BACK_IMAGE_OFFSET_Y = 0; // px

export const toPx = (n: number) => `${n}px`;

export default {
  BASE_WIDTH,
  BASE_HEIGHT,
  LARGE_SCALE,
  OVERLAP_SPACING,
  toPx
};
