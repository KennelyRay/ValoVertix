import { useMemo } from "react";
import {
  cheapestPacks,
  formatMoney,
  formatMoneyRange,
  regionRate,
  regionValue,
  type MoneyRange,
} from "@valovertix/calc";
import { detectRegion, getRegionalPricing, type PricingRegion } from "@/config/pricing";
import { useSettings } from "./settings-store";

const browserLanguages = () =>
  typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language]);

/** The region in use: the saved choice, else a guess from the browser language. */
export function resolveRegion(chosen: string | null): PricingRegion {
  return getRegionalPricing(chosen ?? detectRegion(browserLanguages()));
}

export type Pricing = ReturnType<typeof makePricing>;

/** Every money figure in the app goes through this, so they all use one region. */
export function makePricing(region: PricingRegion, auto: boolean) {
  const format = { locale: region.locale, currency: region.currency };
  const opts = { wholeUnits: region.decimals === 0 };
  return {
    region,
    /** True while no region was picked and the browser-based default is used. */
    auto,
    format,
    rate: regionRate(region),
    /** "Philippines pricing" */
    label: `${region.label} pricing`,
    /** Value of an amount of VP, as a best-pack to smallest-pack range. */
    value: (vp: number) => regionValue(region, vp),
    fmtValue: (vp: number) => formatMoneyRange(regionValue(region, vp), format, opts),
    fmtRange: (range: MoneyRange) => formatMoneyRange(range, format, opts),
    fmtAmount: (amount: number) => formatMoney(amount, format, opts),
    /** Cheapest real packs that buy at least this much VP. */
    spent: (vp: number) => cheapestPacks(region, vp),
  };
}

export function usePricing(): Pricing {
  const chosen = useSettings((s) => s.pricingRegion);
  return useMemo(() => makePricing(resolveRegion(chosen), chosen === null), [chosen]);
}
