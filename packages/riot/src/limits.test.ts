import { describe, expect, it, vi } from "vitest";
import { BlockedRequestError, createLimiter, isRiotUrl, timeoutSignal } from "./limits";

describe("isRiotUrl", () => {
  it("accepts only https Riot origins without credentials", () => {
    expect(isRiotUrl("https://pd.ap.a.pvp.net/store/v1/offers/")).toBe(true);
    expect(isRiotUrl("https://auth.riotgames.com/userinfo")).toBe(true);
    expect(isRiotUrl("http://pd.ap.a.pvp.net/x")).toBe(false);
    expect(isRiotUrl("https://pd.evil.a.pvp.net/x")).toBe(false);
    expect(isRiotUrl("https://pd.ap.a.pvp.net.evil.com/x")).toBe(false);
    expect(isRiotUrl("https://user:pw@pd.ap.a.pvp.net/x")).toBe(false);
    expect(isRiotUrl("https://pd.ap.a.pvp.net:444/x")).toBe(false);
    expect(isRiotUrl("not a url")).toBe(false);
  });

  it("names no address in the blocked error", () => {
    expect(new BlockedRequestError().message).not.toMatch(/https?:/);
  });
});

describe("createLimiter", () => {
  it("never runs more than the cap at once, and keeps going after failures", async () => {
    const limit = createLimiter(2);
    let peak = 0;
    const resolvers: (() => void)[] = [];
    const task = (fail = false) =>
      limit.run(async () => {
        peak = Math.max(peak, limit.active);
        await new Promise<void>((r) => resolvers.push(r));
        if (fail) throw new Error("boom");
        return "ok";
      });
    const runs = [task(), task(true), task(), task()];
    // Collect outcomes right away so the expected failure is never unhandled.
    const settled = Promise.allSettled(runs);
    await Promise.resolve();
    expect(limit.active).toBe(2);
    expect(limit.queued).toBe(2);
    while (resolvers.length || limit.active) {
      resolvers.shift()?.();
      await new Promise((r) => setTimeout(r, 0));
    }
    const results = await settled;
    expect(results.map((r) => r.status)).toEqual([
      "fulfilled",
      "rejected",
      "fulfilled",
      "fulfilled",
    ]);
    expect(peak).toBe(2);
    expect(limit.active).toBe(0);
  });
});

describe("timeoutSignal", () => {
  it("aborts after the time limit and says so", () => {
    vi.useFakeTimers();
    const t = timeoutSignal(1000);
    expect(t.signal.aborted).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(t.signal.aborted).toBe(true);
    expect(t.timedOut()).toBe(true);
    t.done();
    vi.useRealTimers();
  });

  it("follows the caller's signal, already aborted or later", () => {
    const outer = new AbortController();
    const t = timeoutSignal(60_000, outer.signal);
    outer.abort();
    expect(t.signal.aborted).toBe(true);
    expect(t.timedOut()).toBe(false);
    t.done();

    const pre = new AbortController();
    pre.abort();
    expect(timeoutSignal(60_000, pre.signal).signal.aborted).toBe(true);
  });
});
