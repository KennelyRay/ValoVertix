import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CurrencyCode } from "@/config/vp-prices";

export type MotionPreference = "system" | "reduce";

interface SettingsState {
  hideFreeSkins: boolean;
  includeAgents: boolean;
  motion: MotionPreference;
  currency: CurrencyCode;
  showRiotIdOnShare: boolean;
  set: (patch: Partial<Omit<SettingsState, "set">>) => void;
}

/** UI preferences only. No tokens or account data live here. */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      hideFreeSkins: true,
      includeAgents: false,
      motion: "system",
      currency: "PHP",
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
