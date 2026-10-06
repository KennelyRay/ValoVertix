export interface VpPack {
  vp: number;
  price: number;
}

export interface VpRate {
  /** Price per VP when buying the best-value (largest) pack. */
  best: number;
  /** Price per VP when buying the smallest pack. */
  smallest: number;
}

export interface MoneyRange {
  low: number;
  high: number;
}

/** Converts VP to a whole-unit money range: best-value rate to smallest-pack rate. */
export function vpToMoneyRange(vp: number, rate: VpRate): MoneyRange {
  if (!Number.isFinite(vp) || vp <= 0) return { low: 0, high: 0 };
  return { low: Math.round(vp * rate.best), high: Math.round(vp * rate.smallest) };
}

export interface CurrencyFormat {
  locale: string;
  currency: string;
}

export function formatMoney(
  amount: number,
  { locale, currency }: CurrencyFormat,
  opts: { wholeUnits?: boolean } = {},
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    ...(opts.wholeUnits && { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  }).format(amount);
}

export function formatMoneyRange(
  range: MoneyRange,
  format: CurrencyFormat,
  opts: { wholeUnits?: boolean } = { wholeUnits: true },
): string {
  const low = formatMoney(range.low, format, opts);
  if (range.low === range.high) return low;
  return `${low}–${formatMoney(range.high, format, opts)}`;
}

export const formatVp = (vp: number, locale = "en-PH") =>
  `${new Intl.NumberFormat(locale).format(vp)} VP`;
