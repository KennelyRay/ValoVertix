import { fetchGameVersion, isAssetCacheEnabled, versionSchema } from "@valovertix/assets";

const LAST_VERSION_KEY = "vv.gameVersion";

/**
 * The current game version, which keys the static-data cache. If
 * valorant-api.com is down, the last version seen is used instead, so data
 * already cached in IndexedDB keeps the app working through the outage.
 */
export async function gameVersionWithFallback(signal?: AbortSignal) {
  try {
    const v = await fetchGameVersion(fetch, signal);
    try {
      // Same rule as the asset cache: after "Clear all data", store nothing.
      if (isAssetCacheEnabled()) localStorage.setItem(LAST_VERSION_KEY, JSON.stringify(v));
    } catch {
      // Storage blocked: no fallback next time, nothing else changes.
    }
    return v;
  } catch (err) {
    if (signal?.aborted) throw err;
    try {
      const saved = localStorage.getItem(LAST_VERSION_KEY);
      if (saved) return versionSchema.parse(JSON.parse(saved));
    } catch {
      // Unreadable fallback: report the original failure.
    }
    throw err;
  }
}
