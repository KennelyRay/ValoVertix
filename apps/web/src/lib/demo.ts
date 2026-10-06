import { parseAccessUrl } from "@valovertix/riot";
import { fakeAccessUrl } from "@valovertix/riot/test-utils";

const DEMO_FLAG = "vv.demo";
type Worker = { stop: () => void };
let worker: Worker | null = null;

export const isDemoFlagged = () => {
  try {
    return sessionStorage.getItem(DEMO_FLAG) === "1";
  } catch {
    return false;
  }
};

/**
 * Starts the MSW service worker with the same handlers the tests use. Only
 * Riot and valorant-api.com calls are intercepted; images still load live.
 */
export async function startDemoWorker(): Promise<void> {
  if (worker) return;
  const [{ setupWorker }, { createHandlers }] = await Promise.all([
    import("msw/browser"),
    import("@/mocks/handlers"),
  ]);
  const w = setupWorker(...createHandlers({ latency: 250 }));
  await w.start({
    onUnhandledRequest: "bypass",
    quiet: true,
    serviceWorker: { url: "/mockServiceWorker.js" },
  });
  worker = w;
  try {
    sessionStorage.setItem(DEMO_FLAG, "1");
  } catch {
    // Demo still works for this page load.
  }
}

export function stopDemoWorker() {
  worker?.stop();
  worker = null;
  try {
    sessionStorage.removeItem(DEMO_FLAG);
  } catch {
    // ignore
  }
}

/** Fake tokens for the demo account. They only ever reach the MSW worker. */
export function demoTokens() {
  const exp = Math.floor(Date.now() / 1000) + 24 * 3600;
  const parsed = parseAccessUrl(fakeAccessUrl({ exp }));
  if (!parsed.ok) throw new Error("demo tokens");
  return parsed.tokens;
}
