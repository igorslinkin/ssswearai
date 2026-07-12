export const DEFAULT_FREE_CREDITS = 130;

export const CREDIT_PRICE_RUB = 2;

export const GENERATION_COSTS = {
  cyclorama: 25,
  product: 25,
  mobile: 35,
  creative: 45,
  image: 50,
  tryon: 70,
} as const;

export type GenerationMode = keyof typeof GENERATION_COSTS;

export const MAX_UPLOAD_IMAGES = 6;

export const MAX_IMAGE_SIZE = 1400;