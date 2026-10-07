import { useMemo } from "react";
import type { CatalogSkin } from "@valovertix/assets";
import { CURRENCY, ITEM_TYPE } from "@valovertix/riot";
import { useSkinCatalog, useStorefront } from "@/features/data";
import { useWishlist } from "./wishlist-store";

export type ShopPlace = "daily" | "bundle" | "night";

export interface WishlistHit {
  skin: CatalogSkin;
  place: ShopPlace;
  /** What it costs in that shop (Night Market and bundle prices are discounted). */
  vp: number | null;
}

/** Wishlisted skins that are in this account's shop right now. */
export function useWishlistHits() {
  const ids = useWishlist((s) => s.ids);
  const storefront = useStorefront(ids.length > 0);
  const { catalog } = useSkinCatalog();

  const hits = useMemo<WishlistHit[]>(() => {
    const sf = storefront.data;
    if (!sf || !catalog || ids.length === 0) return [];
    const wanted = new Set(ids);
    const out: WishlistHit[] = [];
    const add = (itemTypeId: string, itemId: string, place: ShopPlace, vp: number | null) => {
      if (itemTypeId !== ITEM_TYPE.skinLevel) return;
      const skin = catalog.byLevelId.get(itemId.toLowerCase());
      if (skin && wanted.has(skin.uuid) && !out.some((h) => h.skin.uuid === skin.uuid)) {
        out.push({ skin, place, vp });
      }
    };
    for (const o of sf.daily.offers) {
      for (const rw of o.Rewards)
        add(rw.ItemTypeID, rw.ItemID, "daily", o.Cost[CURRENCY.vp] ?? null);
    }
    for (const n of sf.nightMarket?.offers ?? []) {
      for (const rw of n.offer.Rewards) {
        add(rw.ItemTypeID, rw.ItemID, "night", n.discountedCost[CURRENCY.vp] ?? null);
      }
    }
    for (const b of sf.bundles) {
      for (const i of b.items) {
        add(
          i.itemTypeId,
          i.itemId,
          "bundle",
          i.currencyId === CURRENCY.vp ? i.discountedPrice : null,
        );
      }
    }
    return out;
  }, [storefront.data, catalog, ids]);

  return { hits, ids, isPending: ids.length > 0 && storefront.isPending };
}

export const PLACE_LABEL: Record<ShopPlace, string> = {
  daily: "In your daily shop",
  bundle: "In a featured bundle",
  night: "In your Night Market",
};
