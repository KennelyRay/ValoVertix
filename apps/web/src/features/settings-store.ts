import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type MotionPreference = "system" | "reduce";

interface SettingsState {
  hideFreeSkins: boolean;
  /** Hide collections made only of battle pass, contract or no-tier skins. */
  hideFreeBundles: boolean;
  includeAgents: boolean;
  motion: MotionPreference;
  /** Bundle or map art behind the page. The grid always shows. */
  backdropArt: boolean;
  /** Currency code of the VP price region, or null to follow the browser language. */
  pricingRegion: string | null;
  showRiotIdOnShare: boolean;
  set: (patch: Partial<Omit<SettingsState, "set">>) => void;
}

/** UI preferences only. No tokens or account data live here. */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      hideFreeSkins: true,
      hideFreeBundles: true,
      includeAgents: false,
      motion: "system",
      backdropArt: true,
      pricingRegion: null,
      showRiotIdOnShare: false,
      set: (patch) => set(patch),
    }),
    {
      name: "vv.settings",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ set: _set, showRiotIdOnShare: _id, ...rest }) => rest,
    },
  ),
);
