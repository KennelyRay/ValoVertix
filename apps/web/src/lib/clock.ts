/** Below this, the Date header's one-second resolution and the round trip are noise. */
const MIN_SKEW_MS = 30_000;

let skewMs = 0;
let pending: Promise<number> | null = null;

/**
 * Measures how far this device's clock runs ahead of real time (negative when
 * it runs behind), once per page load. Riot's Date header is hidden by CORS,
 * so this reads our own server's, which is same-origin. On failure the device
 * clock is trusted and the next call tries again.
 */
export function measureClockSkew(): Promise<number> {
  return (pending ??= (async () => {
    try {
      const sent = Date.now();
      const res = await fetch(new URL("/", window.location.href), {
        method: "HEAD",
        cache: "no-store",
      });
      const received = Date.now();
      const server = Date.parse(res.headers.get("date") ?? "");
      if (Number.isNaN(server)) return skewMs;
      // The header is truncated to the second, so +500 ms is its midpoint.
      const skew = (sent + received) / 2 - (server + 500);
      skewMs = Math.abs(skew) >= MIN_SKEW_MS ? Math.round(skew) : 0;
    } catch {
      pending = null;
    }
    return skewMs;
  })());
}

/** The last measured skew in milliseconds, or 0 before the first measurement. */
export const clockSkew = () => skewMs;

/** For tests. */
export function resetClockSkew() {
  skewMs = 0;
  pending = null;
}
