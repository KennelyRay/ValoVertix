import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface WishlistState {
  /** Skin UUIDs, lowercase, newest first. Game content IDs only, no account data. */
  ids: string[];
  toggle: (skinId: string) => void;
  remove: (skinId: string) => void;
}

/** Skins you want, kept on this device only (cleared by "Clear all data"). */
export const useWishlist = create<WishlistState>()(
  persist(
    (set) => ({
      ids: [],
      toggle: (skinId) =>
        set(({ ids }) => {
          const id = skinId.toLowerCase();
          return { ids: ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids] };
        }),
      remove: (skinId) =>
        set(({ ids }) => ({ ids: ids.filter((x) => x !== skinId.toLowerCase()) })),
    }),
    {
      name: "vv.wishlist",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ ids }) => ({ ids }),
    },
  ),
);
