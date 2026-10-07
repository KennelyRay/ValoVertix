import { buildRegions, type RegionPricing } from "@valovertix/calc";
// The single source of regional VP prices. Update that file when Riot changes pricing.
import priceList from "../../../../docs/valorant_vp_pricing.json";

export interface PricingRegion extends RegionPricing {
  /** Stable ID saved in settings: the currency code. */
  id: string;
  /** "Philippines", "USA", ... */
  label: string;
  /** Number formatting for the currency. */
  locale: string;
}

/**
 * Display details per currency, in menu order. Countries are ISO 3166 codes
 * used to guess a default from the browser language. A region in the price
 * list without an entry here still works, with plain US formatting.
 */
const REGION_INFO: Record<string, { label: string; locale: string; countries: string[] }> = {
  PHP: { label: "Philippines", locale: "en-PH", countries: ["PH"] },
  USD: { label: "USA", locale: "en-US", countries: ["US"] },
  EUR: {
    label: "Europe",
    locale: "en-IE",
    countries: [
      "AT",
      "BE",
      "CY",
      "DE",
      "EE",
      "ES",
      "FI",
      "FR",
      "GR",
      "HR",
      "IE",
      "IT",
      "LT",
      "LU",
      "LV",
      "MT",
      "NL",
      "PT",
      "SI",
      "SK",
    ],
  },
  GBP: { label: "UK", locale: "en-GB", countries: ["GB"] },
  CAD: { label: "Canada", locale: "en-CA", countries: ["CA"] },
  AUD: { label: "Australia", locale: "en-AU", countries: ["AU"] },
  BRL: { label: "Brazil", locale: "pt-BR", countries: ["BR"] },
  MXN: { label: "Mexico", locale: "es-MX", countries: ["MX"] },
  TRY: { label: "Turkey", locale: "tr-TR", countries: ["TR"] },
  INR: { label: "India", locale: "en-IN", countries: ["IN"] },
  MYR: { label: "Malaysia", locale: "ms-MY", countries: ["MY"] },
  NZD: { label: "New Zealand", locale: "en-NZ", countries: ["NZ"] },
  RUB: { label: "Russia", locale: "ru-RU", countries: ["RU"] },
};
const ORDER = Object.keys(REGION_INFO);

export const PRICING_REGIONS: PricingRegion[] = buildRegions(priceList)
  .map((r) => ({
    ...r,
    id: r.currency,
    label: REGION_INFO[r.currency]?.label ?? r.region,
    locale: REGION_INFO[r.currency]?.locale ?? "en-US",
  }))
  .sort((a, b) => {
    const ia = ORDER.indexOf(a.id);
    const ib = ORDER.indexOf(b.id);
    return (ia === -1 ? ORDER.length : ia) - (ib === -1 ? ORDER.length : ib);
  });

/** Used when nothing else fits; the app started with Philippine pricing. */
export const FALLBACK_REGION = "PHP";

/** Guesses a pricing region from browser languages like "en-PH" or "de-DE". */
export function detectRegion(languages: readonly string[]): string {
  for (const lang of languages) {
    const country = lang.split("-")[1]?.toUpperCase();
    if (!country) continue;
    const match = PRICING_REGIONS.find((r) => REGION_INFO[r.id]?.countries.includes(country));
    if (match) return match.id;
  }
  return FALLBACK_REGION;
}

/** A region's pricing; an unknown or missing ID falls back instead of failing. */
export function getRegionalPricing(id: string | null | undefined): PricingRegion {
  return (
    PRICING_REGIONS.find((r) => r.id === id) ??
    PRICING_REGIONS.find((r) => r.id === FALLBACK_REGION) ??
    PRICING_REGIONS[0]!
  );
}

export const regionOptionLabel = (r: PricingRegion) => `${r.label} (${r.currency})`;
