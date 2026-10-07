import type { MoneyRange, VpPack, VpRate } from "./currency";

/** One row of the regional VP price list (docs/valorant_vp_pricing.json). */
export interface VpPriceRow {
  region: string;
  currency: string;
  vp_amount: number;
  local_price: number;
}

export interface RegionPricing {
  /** Region name as in the price list, e.g. "Philippines". */
  region: string;
  /** ISO 4217 code, e.g. "PHP". */
  currency: string;
  /** Packs, smallest first. */
  packs: VpPack[];
  /** 2 when any pack price has cents (e.g. $4.99), else 0. */
  decimals: 0 | 2;
}

/**
 * Groups the price list by region. Rows with a missing or non-positive
 * amount or price are skipped, and so is a region left with no packs.
 */
export function buildRegions(rows: readonly VpPriceRow[]): RegionPricing[] {
  const byRegion = new Map<string, RegionPricing>();
  for (const row of rows) {
    const ok =
      typeof row.region === "string" &&
      row.region.trim() !== "" &&
      /^[A-Z]{3}$/.test(row.currency) &&
      row.vp_amount > 0 &&
      row.local_price > 0;
    if (!ok) continue;
    const region = byRegion.get(row.region) ?? {
      region: row.region,
      currency: row.currency,
      packs: [],
      decimals: 0 as const,
    };
    if (region.currency !== row.currency) continue; // one currency per region
    region.packs.push({ vp: row.vp_amount, price: row.local_price });
    if (!Number.isInteger(row.local_price)) region.decimals = 2;
    byRegion.set(row.region, region);
  }
  for (const r of byRegion.values()) r.packs.sort((a, b) => a.vp - b.vp);
  return [...byRegion.values()];
}

/** Price per VP at the best-value pack and at the worst-value pack. */
export function regionRate(region: Pick<RegionPricing, "packs">): VpRate {
  const perVp = region.packs.map((p) => p.price / p.vp);
  return { best: Math.min(...perVp), smallest: Math.max(...perVp) };
}

/** What an amount of VP is worth in a region: best-value rate to worst-value rate. */
export function regionValue(region: RegionPricing, vp: number): MoneyRange {
  if (!Number.isFinite(vp) || vp <= 0) return { low: 0, high: 0 };
  const rate = regionRate(region);
  const f = 10 ** region.decimals;
  return { low: Math.round(vp * rate.best * f) / f, high: Math.round(vp * rate.smallest * f) / f };
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

export interface PackPlan {
  /** Packs to buy, largest first. */
  packs: { vp: number; price: number; count: number }[];
  /** VP received, at least the amount asked for. */
  vp: number;
  price: number;
}

/**
 * The cheapest set of packs that gives at least `vp` VP: what buying that
 * VP would cost at the region's real pack prices (no exchange rates).
 */
export function cheapestPacks(region: RegionPricing, vp: number): PackPlan {
  if (!Number.isFinite(vp) || vp <= 0 || region.packs.length === 0) {
    return { packs: [], vp: 0, price: 0 };
  }
  // Work in units of the packs' common divisor to keep the table small.
  const unit = region.packs.reduce((g, p) => gcd(g, Math.round(p.vp)), 0);
  const packs = region.packs.map((p) => ({ ...p, units: Math.round(p.vp) / unit }));
  const target = Math.ceil(vp / unit);
  const limit = target + Math.max(...packs.map((p) => p.units));
  // Prices in cents so sums stay exact.
  const cost = new Float64Array(limit + 1).fill(Infinity);
  const pick = new Int16Array(limit + 1).fill(-1);
  cost[0] = 0;
  for (let u = 1; u <= limit; u++) {
    for (let i = 0; i < packs.length; i++) {
      const p = packs[i]!;
      if (p.units > u) continue;
      const c = cost[u - p.units]! + Math.round(p.price * 100);
      if (c < cost[u]!) {
        cost[u] = c;
        pick[u] = i;
      }
    }
  }
  let best = target;
  for (let u = target; u <= limit; u++) if (cost[u]! < cost[best]!) best = u;

  const counts = new Map<number, number>();
  for (let u = best; u > 0; u -= packs[pick[u]!]!.units) {
    counts.set(pick[u]!, (counts.get(pick[u]!) ?? 0) + 1);
  }
  const chosen = [...counts.entries()]
    .map(([i, count]) => ({ vp: packs[i]!.vp, price: packs[i]!.price, count }))
    .sort((a, b) => b.vp - a.vp);
  return { packs: chosen, vp: best * unit, price: cost[best]! / 100 };
}

/**
 * Collection value: every item's VP valued at the region's pack rates. Value is
 * linear in VP, so the total is valued once (no per-item rounding drift).
 */
export function calculateCollectionValue(
  items: readonly { vp: number }[],
  region: RegionPricing,
): MoneyRange {
  return regionValue(region, sumVp(items));
}

const sumVp = (items: readonly { vp: number }[]) =>
  items.reduce((s, i) => s + (Number.isFinite(i.vp) ? Math.max(0, i.vp) : 0), 0);

/** Total spent: the cheapest real packs that would buy all the VP the items cost. */
export function calculateTotalSpent(items: readonly { vp: number }[], region: RegionPricing) {
  return cheapestPacks(region, sumVp(items));
}
