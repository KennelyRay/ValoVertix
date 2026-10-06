import type { Shard } from "./endpoints";

const REGION_TO_SHARD: Record<string, Shard> = {
  na: "na",
  latam: "na",
  br: "na",
  pbe: "na",
  eu: "eu",
  ap: "ap",
  kr: "kr",
};

/** Maps a riot-geo `affinities.live` region to its pd shard, or null if unknown. */
export function regionToShard(region: string | null | undefined): Shard | null {
  if (!region) return null;
  return REGION_TO_SHARD[region.trim().toLowerCase()] ?? null;
}

export const DEFAULT_SHARD: Shard = "ap";

export const SHARD_LABELS: Record<Shard, string> = {
  na: "North America, LATAM, Brazil",
  eu: "Europe",
  ap: "Asia Pacific",
  kr: "Korea",
};
