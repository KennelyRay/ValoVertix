import type { OfferIndex, OfferLike, OwnedSkin, SkinRef } from "./types";

/** Indexes store offers by the item they grant. Multi-reward offers are skipped. */
export function indexOffers(offers: readonly OfferLike[]): OfferIndex {
  const index = new Map<string, Readonly<Record<string, number>>>();
  for (const offer of offers) {
    const [reward, ...others] = offer.Rewards;
    if (!reward || others.length > 0) continue;
    index.set(reward.ItemID.toLowerCase(), offer.Cost);
  }
  return index;
}

/**
 * Groups owned level and chroma IDs into skins. A skin counts as owned when
 * any of its levels is owned. Default skins are excluded.
 */
export function resolveOwnedSkins<S extends SkinRef>(
  skins: readonly S[],
  ownedLevelIds: Iterable<string>,
  ownedChromaIds: Iterable<string>,
): OwnedSkin<S>[] {
  const levels = new Set([...ownedLevelIds].map((id) => id.toLowerCase()));
  const chromas = new Set([...ownedChromaIds].map((id) => id.toLowerCase()));
  const out: OwnedSkin<S>[] = [];
  for (const skin of skins) {
    if (skin.isDefault) continue;
    const levelIds = skin.levels.map((l) => l.uuid).filter((id) => levels.has(id.toLowerCase()));
    if (levelIds.length === 0) continue;
    const chromaIds = skin.chromas
      .slice(1)
      .map((c) => c.uuid)
      .filter((id) => chromas.has(id.toLowerCase()));
    out.push({ skin, levelIds, chromaIds });
  }
  return out;
}

export function countBy<T>(
  items: readonly T[],
  key: (item: T) => string | null,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item) ?? "unknown";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

/** Owned upgrades beyond the base level and base chroma. */
export const upgradeCount = (owned: OwnedSkin) =>
  Math.max(0, owned.levelIds.length - 1) + owned.chromaIds.length;

export interface CollectionGroup<S extends SkinRef> {
  themeId: string;
  /** Every non-default skin in the collection, owned or not. */
  skins: S[];
  owned: OwnedSkin<S>[];
}

/**
 * Groups skins into their collections (themes), for every collection the
 * player owns at least one skin from, with owned vs total counts.
 */
export function groupByCollection<S extends SkinRef>(
  allSkins: readonly S[],
  owned: readonly OwnedSkin<S>[],
): CollectionGroup<S>[] {
  const ownedByTheme = new Map<string, OwnedSkin<S>[]>();
  for (const o of owned) {
    if (!o.skin.themeId) continue;
    ownedByTheme.set(o.skin.themeId, [...(ownedByTheme.get(o.skin.themeId) ?? []), o]);
  }
  return [...ownedByTheme.entries()].map(([themeId, ownedSkins]) => ({
    themeId,
    skins: allSkins.filter((s) => s.themeId === themeId && !s.isDefault),
    owned: ownedSkins,
  }));
}
