// Centralized card sizing configuration used by Blackjack card components.
// Change `BASE_WIDTH` and `BASE_HEIGHT` here to resize all cards.
export const BASE_WIDTH = 115; // px
export const BASE_HEIGHT = 165; // px
export const LARGE_SCALE = 1.25; // multiplier when 'large' is requested
export const BASE_HEIGHT_FOR_SCALE = 750; // screen height (px) at which cards are full size (scale=1)
export const OVERLAP_SPACING = 48; // px between stacked cards (base)
// Sensitivity controls how aggressively cards scale when the screen is smaller than
// `BASE_HEIGHT_FOR_SCALE`. 1 = linear scaling (current behavior). Values > 1
// make the scaling more aggressive (cards shrink faster on smaller screens).
export const SCALE_SENSITIVITY = 3.5; // tweak this to taste

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
  BASE_HEIGHT_FOR_SCALE,
  OVERLAP_SPACING,
  SCALE_SENSITIVITY,
  toPx
};
