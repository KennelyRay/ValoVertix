// Standard single-skin VP list prices by content tier. Used ONLY when Riot's
// store price list (/store/v1/offers) is unavailable (it returns 404 for
// tokens from the playvalorant.com sign-in as of 2026-10-06). These are the
// common list prices, not fetched from Riot: Exclusive and Ultra skins vary
// in practice. Update if Riot reprices a tier.
export const TIER_PRICES_VP = {
  gun: { Select: 875, Deluxe: 1275, Premium: 1775, Exclusive: 2175, Ultra: 2475 },
  melee: { Select: 1750, Deluxe: 2550, Premium: 3550, Exclusive: 4350, Ultra: 4950 },
} as const;

export type TierName = keyof (typeof TIER_PRICES_VP)["gun"];

/** Standard price for a tier (by valorant-api.com devName) and weapon category. */
export function tierPriceVp(tierDevName: string | undefined, weaponCategory: string) {
  if (!tierDevName || !(tierDevName in TIER_PRICES_VP.gun)) return undefined;
  const table = weaponCategory === "Melee" ? TIER_PRICES_VP.melee : TIER_PRICES_VP.gun;
  return table[tierDevName as TierName];
}
