import { RIOT_CONNECT_HOSTS } from "./endpoints";

/**
 * Defence in depth for the Riot client. The CSP already limits where the
 * browser may connect; these checks run before any request is built, so a
 * bug can't attach tokens to a non-Riot address even where the CSP is absent
 * (tests, other hosts, browser extensions that relax it).
 */
export function isRiotUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      u.username === "" &&
      u.password === "" &&
      (RIOT_CONNECT_HOSTS as readonly string[]).includes(u.origin)
    );
  } catch {
    return false;
  }
}

/** Thrown instead of sending credentials anywhere but Riot. Carries no URL. */
export class BlockedRequestError extends Error {
  constructor() {
    super("Refused to send Riot credentials to a non-Riot address");
    this.name = "BlockedRequestError";
  }
}

/**
 * Caps how many requests run at once. A page can ask for 20 match details at
 * the same moment; queueing them keeps Riot's rate limits (and slow phones)
 * happy without changing what the page shows.
 */
export function createLimiter(max: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  const release = () => {
    active -= 1;
    waiting.shift()?.();
  };
  return {
    get active() {
      return active;
    },
    get queued() {
      return waiting.length;
    },
    async run<T>(task: () => Promise<T>): Promise<T> {
      if (active >= max) await new Promise<void>((resolve) => waiting.push(resolve));
      active += 1;
      try {
        return await task();
      } finally {
        release();
      }
    },
  };
}

/**
 * A signal that aborts when the caller's does or after `ms`, whichever comes
 * first. `timedOut()` tells the two apart.
 */
export function timeoutSignal(ms: number, outer?: AbortSignal | null) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ms);
  const onOuter = () => controller.abort(outer?.reason);
  if (outer?.aborted) onOuter();
  else outer?.addEventListener("abort", onOuter, { once: true });
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    done: () => {
      clearTimeout(timer);
      outer?.removeEventListener("abort", onOuter);
    },
  };
}
