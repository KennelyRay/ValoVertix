import type { OfferIndex, OwnedSkin, SkinRef } from "./types";

export const AGENT_UNLOCK_VP = 1000;

export interface CurrencyIds {
  vp: string;
  radianite: string;
}

export type PriceSource = "offer" | "tier";

export interface PricedSkin<S extends SkinRef = SkinRef> {
  owned: OwnedSkin<S>;
  vp: number;
  /** "offer": Riot's store price. "tier": the standard price for its tier (fallback). */
  source: PriceSource;
}

export type UnpricedReason = "contract" | "no_offer";

export interface UnpricedSkin<S extends SkinRef = SkinRef> {
  owned: OwnedSkin<S>;
  reason: UnpricedReason;
}

export interface Breakdown {
  key: string;
  vp: number;
  count: number;
}

export interface SpendingInput<S extends SkinRef> {
  ownedSkins: readonly OwnedSkin<S>[];
  offers: OfferIndex;
  currency: CurrencyIds;
  includeAgents?: boolean;
  /** Owned agent IDs that are not free starter agents. */
  paidAgentIds?: readonly string[];
  /**
   * Used when a skin has no store offer, e.g. when Riot's price list is
   * unavailable. Contract rewards are never priced this way.
   */
  fallbackVp?: (skin: S) => number | undefined;
}

export interface SpendingResult<S extends SkinRef = SkinRef> {
  priced: PricedSkin<S>[];
  unpriced: UnpricedSkin<S>[];
  skinVp: number;
  agentCount: number;
  agentVp: number;
  totalVp: number;
  radianite: number;
  /** Owned upgrades (levels + chromas) that had a Radianite price. */
  radianiteItems: number;
  byTier: Breakdown[];
  byWeapon: Breakdown[];
  byTheme: Breakdown[];
}

function breakdown<S extends SkinRef>(
  priced: readonly PricedSkin<S>[],
  key: (s: S) => string | null,
): Breakdown[] {
  const map = new Map<string, Breakdown>();
  for (const p of priced) {
    const k = key(p.owned.skin) ?? "unknown";
    const entry = map.get(k) ?? { key: k, vp: 0, count: 0 };
    entry.vp += p.vp;
    entry.count += 1;
    map.set(k, entry);
  }
  return [...map.values()].sort((a, b) => b.vp - a.vp || b.count - a.count);
}

/** Radianite cost of the owned levels after the first and owned non-base chromas. */
export function radianiteForSkin(owned: OwnedSkin, offers: OfferIndex, radianiteId: string) {
  let total = 0;
  let items = 0;
  const base = owned.skin.levels[0]?.uuid.toLowerCase();
  const upgradeIds = [
    ...owned.levelIds.filter((id) => id.toLowerCase() !== base),
    ...owned.chromaIds,
  ];
  for (const id of upgradeIds) {
    const cost = offers.get(id.toLowerCase())?.[radianiteId];
    if (cost !== undefined && cost > 0) {
      total += cost;
      items += 1;
    }
  }
  return { total, items };
}

/**
 * Estimates what an inventory cost in VP.
 * - Priced: the base level matches a store offer with a VP cost.
 * - Unpriced: no VP offer (contract rewards, exclusives, events); excluded from totals.
 */
export function computeSpending<S extends SkinRef>(input: SpendingInput<S>): SpendingResult<S> {
  const { ownedSkins, offers, currency } = input;
  const priced: PricedSkin<S>[] = [];
  const unpriced: UnpricedSkin<S>[] = [];
  let radianite = 0;
  let radianiteItems = 0;

  for (const owned of ownedSkins) {
    const baseId = owned.skin.levels[0]?.uuid.toLowerCase();
    const vp = baseId ? offers.get(baseId)?.[currency.vp] : undefined;
    const fallback = owned.skin.isContractReward ? undefined : input.fallbackVp?.(owned.skin);
    if (vp !== undefined && vp > 0) priced.push({ owned, vp, source: "offer" });
    else if (fallback !== undefined && fallback > 0)
      priced.push({ owned, vp: fallback, source: "tier" });
    else unpriced.push({ owned, reason: owned.skin.isContractReward ? "contract" : "no_offer" });

    const r = radianiteForSkin(owned, offers, currency.radianite);
    radianite += r.total;
    radianiteItems += r.items;
  }

  priced.sort((a, b) => b.vp - a.vp || a.owned.skin.name.localeCompare(b.owned.skin.name));
  unpriced.sort((a, b) => a.owned.skin.name.localeCompare(b.owned.skin.name));

  const skinVp = priced.reduce((sum, p) => sum + p.vp, 0);
  const agentCount = input.includeAgents ? (input.paidAgentIds?.length ?? 0) : 0;
  const agentVp = agentCount * AGENT_UNLOCK_VP;

  return {
    priced,
    unpriced,
    skinVp,
    agentCount,
    agentVp,
    totalVp: skinVp + agentVp,
    radianite,
    radianiteItems,
    byTier: breakdown(priced, (s) => s.tierId),
    byWeapon: breakdown(priced, (s) => s.weaponId),
    byTheme: breakdown(priced, (s) => s.themeId),
  };
}

/** Share of owned skins that have a store price, 0–1. */
export const pricedRatio = (result: Pick<SpendingResult, "priced" | "unpriced">) => {
  const total = result.priced.length + result.unpriced.length;
  return total === 0 ? 0 : result.priced.length / total;
};

/** Radianite still needed to unlock every level and chroma of an owned skin. */
export function radianiteToMax(owned: OwnedSkin, offers: OfferIndex, radianiteId: string) {
  const have = new Set([...owned.levelIds, ...owned.chromaIds].map((id) => id.toLowerCase()));
  const missing = [...owned.skin.levels.slice(1), ...owned.skin.chromas.slice(1)]
    .map((x) => x.uuid.toLowerCase())
    .filter((id) => !have.has(id));
  let total = 0;
  let items = 0;
  for (const id of missing) {
    const cost = offers.get(id)?.[radianiteId];
    if (cost !== undefined && cost > 0) {
      total += cost;
      items += 1;
    }
  }
  return { total, items };
}

/** Store VP price of a skin's base level, else the fallback (never for contract rewards). */
export function skinPriceVp<S extends SkinRef>(
  skin: S,
  offers: OfferIndex,
  vpId: string,
  fallbackVp?: (skin: S) => number | undefined,
): number | undefined {
  const base = skin.levels[0]?.uuid.toLowerCase();
  const vp = base ? offers.get(base)?.[vpId] : undefined;
  if (vp !== undefined && vp > 0) return vp;
  if (skin.isContractReward) return undefined;
  const fallback = fallbackVp?.(skin);
  return fallback !== undefined && fallback > 0 ? fallback : undefined;
}
