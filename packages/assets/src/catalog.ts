import type { SkinRef } from "@valovertix/calc";
import type {
  Agent,
  Buddy,
  CompetitiveTier,
  CompetitiveTierSet,
  ContentTier,
  Contract,
  GameMap,
  PlayerCard,
  PlayerTitle,
  Spray,
  Weapon,
} from "./schemas";

export interface CatalogLevel {
  uuid: string;
  name: string;
  /** Short upgrade label, e.g. "VFX" or "Finisher"; null for the base level. */
  upgrade: string | null;
  icon: string | null;
  video: string | null;
}

export interface CatalogChroma {
  uuid: string;
  name: string;
  icon: string | null;
  fullRender: string | null;
  swatch: string | null;
  video: string | null;
}

export interface CatalogSkin extends SkinRef {
  weaponName: string;
  weaponCategory: string;
  icon: string | null;
  levels: CatalogLevel[];
  chromas: CatalogChroma[];
}

export interface WeaponInfo {
  uuid: string;
  name: string;
  category: string;
  icon: string | null;
}

export interface SkinCatalog {
  skins: CatalogSkin[];
  weapons: WeaponInfo[];
  byId: Map<string, CatalogSkin>;
  byLevelId: Map<string, CatalogSkin>;
  byChromaId: Map<string, CatalogSkin>;
}

const lc = (s: string) => s.toLowerCase();

/** "EEquippableSkinLevelItem::KillCounter" -> "Kill Counter" */
export function upgradeLabel(levelItem: string | null): string | null {
  if (!levelItem) return null;
  const raw = levelItem.split("::").pop() ?? levelItem;
  return raw.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/And/g, "&");
}

/** Clean a chroma/level name like "Neptune Odin Level 3\n(Variant 1 Black)". */
export const cleanName = (name: string) => name.replace(/\s*\n\s*/g, " ").trim();

/** Skin level IDs handed out by battle passes, agent contracts and event passes. */
export function contractSkinLevelIds(contracts: readonly Contract[]): Set<string> {
  const ids = new Set<string>();
  for (const c of contracts) {
    for (const chapter of c.content.chapters ?? []) {
      const rewards = [...chapter.levels.map((l) => l.reward), ...(chapter.freeRewards ?? [])];
      for (const r of rewards) if (r.type === "EquippableSkinLevel") ids.add(lc(r.uuid));
    }
  }
  return ids;
}

const WEAPON_ORDER = ["Sidearm", "SMG", "Shotgun", "Rifle", "Sniper", "Heavy", "Melee"];
const categoryName = (category: string) => category.split("::").pop() ?? category;

export function buildSkinCatalog(
  weapons: readonly Weapon[],
  contracts: readonly Contract[],
): SkinCatalog {
  const contractLevels = contractSkinLevelIds(contracts);
  const skins: CatalogSkin[] = [];
  const weaponInfos: WeaponInfo[] = [];

  const sortedWeapons = [...weapons].sort(
    (a, b) =>
      WEAPON_ORDER.indexOf(categoryName(a.category)) -
        WEAPON_ORDER.indexOf(categoryName(b.category)) ||
      a.displayName.localeCompare(b.displayName),
  );

  for (const w of sortedWeapons) {
    const category = categoryName(w.category);
    weaponInfos.push({ uuid: lc(w.uuid), name: w.displayName, category, icon: w.displayIcon });
    for (const s of w.skins) {
      const levels = s.levels.map((l, i) => ({
        uuid: lc(l.uuid),
        name: cleanName(l.displayName),
        upgrade: i === 0 ? null : upgradeLabel(l.levelItem),
        icon: l.displayIcon,
        video: l.streamedVideo,
      }));
      skins.push({
        uuid: lc(s.uuid),
        name: cleanName(s.displayName),
        weaponId: lc(w.uuid),
        weaponName: w.displayName,
        weaponCategory: category,
        tierId: s.contentTierUuid ? lc(s.contentTierUuid) : null,
        themeId: s.themeUuid ? lc(s.themeUuid) : null,
        icon: s.displayIcon ?? s.chromas[0]?.fullRender ?? s.levels[0]?.displayIcon ?? null,
        levels,
        chromas: s.chromas.map((c) => ({
          uuid: lc(c.uuid),
          name: cleanName(c.displayName),
          icon: c.displayIcon,
          fullRender: c.fullRender,
          swatch: c.swatch,
          video: c.streamedVideo,
        })),
        isDefault:
          lc(s.uuid) === lc(w.defaultSkinUuid) ||
          /^(standard|random favorite)\b/i.test(s.displayName),
        isContractReward: levels.some((l) => contractLevels.has(l.uuid)),
      });
    }
  }

  const byId = new Map(skins.map((s) => [s.uuid, s]));
  const byLevelId = new Map(skins.flatMap((s) => s.levels.map((l) => [l.uuid, s] as const)));
  const byChromaId = new Map(skins.flatMap((s) => s.chromas.map((c) => [c.uuid, s] as const)));
  return { skins, weapons: weaponInfos, byId, byLevelId, byChromaId };
}

// ---- Lookups for other static data ----------------------------------------

export const indexBy = <T extends { uuid: string }>(items: readonly T[]) =>
  new Map(items.map((i) => [lc(i.uuid), i]));

/** Buddy entitlements return level IDs; map each level (and the buddy itself) to the buddy. */
export const indexBuddies = (buddies: readonly Buddy[]) =>
  new Map(
    buddies.flatMap((b) => [
      [lc(b.uuid), b] as const,
      ...b.levels.map((l) => [lc(l.uuid), b] as const),
    ]),
  );

export const indexSprays = (sprays: readonly Spray[]) =>
  new Map(
    sprays.flatMap((s) => [
      [lc(s.uuid), s] as const,
      ...s.levels.map((l) => [lc(l.uuid), s] as const),
    ]),
  );

/** Resolves owned IDs to unique items, dropping unknown IDs. */
export function resolveOwned<T extends { uuid: string; displayName: string }>(
  ids: readonly string[],
  index: Map<string, T>,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const id of ids) {
    const item = index.get(lc(id));
    if (item && !seen.has(item.uuid)) {
      seen.add(item.uuid);
      out.push(item);
    }
  }
  return out.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** The newest competitive tier set (the API lists episodes oldest first). */
export function latestTierSet(sets: readonly CompetitiveTierSet[]): Map<number, CompetitiveTier> {
  const last = sets[sets.length - 1];
  return new Map((last?.tiers ?? []).map((t) => [t.tier, t]));
}

export const tierRankOrder = (tiers: readonly ContentTier[]) =>
  [...tiers].sort((a, b) => a.rank - b.rank);

/** Match details report the map as a mapUrl, e.g. /Game/Maps/Ascent/Ascent. */
export const indexMapsByUrl = (maps: readonly GameMap[]) =>
  new Map(maps.map((m) => [lc(m.mapUrl), m]));

export const paidAgentIds = (ownedAgentIds: readonly string[], agents: readonly Agent[]) => {
  const base = new Set(agents.filter((a) => a.isBaseContent).map((a) => lc(a.uuid)));
  const known = new Set(agents.map((a) => lc(a.uuid)));
  return [...new Set(ownedAgentIds.map(lc))].filter((id) => known.has(id) && !base.has(id));
};

export type { PlayerCard, PlayerTitle };
