import { useMemo } from "react";
import { indexBuddies, indexBy, indexSprays, type ContentTier } from "@valovertix/assets";
import { ITEM_TYPE } from "@valovertix/riot";
import { useSkinCatalog, useStatic } from "@/features/data";

export interface StoreItem {
  name: string;
  image: string | null;
  kind: "Skin" | "Buddy" | "Player card" | "Spray" | "Title" | "Item";
  /** Card art is wide; everything else is roughly square or weapon-shaped. */
  wide: boolean;
  tier: ContentTier | undefined;
  weaponName: string | null;
}

/** Resolves storefront item IDs (skin levels, buddy levels, cards, sprays, titles) to display data. */
export function useStoreItems() {
  const { catalog, tierById } = useSkinCatalog();
  const buddies = useStatic("buddies");
  const cards = useStatic("playerCards");
  const sprays = useStatic("sprays");
  const titles = useStatic("titles");

  return useMemo(() => {
    const buddyIndex = indexBuddies(buddies.data ?? []);
    const cardIndex = indexBy(cards.data ?? []);
    const sprayIndex = indexSprays(sprays.data ?? []);
    const titleIndex = indexBy(titles.data ?? []);

    return (itemTypeId: string, itemId: string): StoreItem => {
      const id = itemId.toLowerCase();
      const base = { tier: undefined, weaponName: null, wide: false } as const;
      switch (itemTypeId) {
        case ITEM_TYPE.skinLevel: {
          const skin = catalog?.byLevelId.get(id);
          return skin
            ? {
                name: skin.name,
                image: skin.icon,
                kind: "Skin",
                wide: false,
                tier: skin.tierId ? tierById.get(skin.tierId) : undefined,
                weaponName: skin.weaponName,
              }
            : { ...base, name: "Unknown skin", image: null, kind: "Skin" };
        }
        case ITEM_TYPE.buddy: {
          const b = buddyIndex.get(id);
          return {
            ...base,
            name: b?.displayName ?? "Unknown buddy",
            image: b?.displayIcon ?? null,
            kind: "Buddy",
          };
        }
        case ITEM_TYPE.playerCard: {
          const c = cardIndex.get(id);
          return {
            ...base,
            name: c?.displayName ?? "Unknown card",
            image: c?.wideArt ?? c?.displayIcon ?? null,
            kind: "Player card",
            wide: true,
          };
        }
        case ITEM_TYPE.spray: {
          const s = sprayIndex.get(id);
          return {
            ...base,
            name: s?.displayName ?? "Unknown spray",
            image: s?.fullTransparentIcon ?? s?.displayIcon ?? null,
            kind: "Spray",
          };
        }
        case ITEM_TYPE.title: {
          const t = titleIndex.get(id);
          return {
            ...base,
            name: t?.titleText ?? t?.displayName ?? "Unknown title",
            image: null,
            kind: "Title",
          };
        }
        default:
          return { ...base, name: "Store item", image: null, kind: "Item" };
      }
    };
  }, [catalog, tierById, buddies.data, cards.data, sprays.data, titles.data]);
}
