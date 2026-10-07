// VP pack prices (PHP), captured 2026-10-05. Update when Riot changes pricing.
export const VP_PACKS_PHP = [
  { vp: 475, price: 199 }, // ₱0.419/VP
  { vp: 1000, price: 399 }, // ₱0.399/VP
  { vp: 2050, price: 799 }, // ₱0.390/VP
  { vp: 3650, price: 1399 }, // ₱0.383/VP
  { vp: 5350, price: 1999 }, // ₱0.374/VP
  { vp: 11000, price: 3999 }, // ₱0.364/VP
] as const;

export const VP_PRICES = {
  PHP: { symbol: "₱", locale: "en-PH", packs: VP_PACKS_PHP },
} as const;

export const vpRate = (packs: readonly { vp: number; price: number }[]) => ({
  best: Math.min(...packs.map((p) => p.price / p.vp)), // ≈ ₱0.364
  smallest: Math.max(...packs.map((p) => p.price / p.vp)), // ≈ ₱0.419
});

export type CurrencyCode = keyof typeof VP_PRICES;
export const DEFAULT_CURRENCY: CurrencyCode = "PHP";
