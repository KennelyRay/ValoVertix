import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screen } from "@testing-library/react";
import { RIOT_CONNECT_HOSTS } from "@valovertix/riot";
import { clearAllData } from "@/lib/clear-data";
import { loadVault } from "@/lib/vault";
import { useSessionStore } from "@/features/auth/session-store";
import { server } from "./server";
import { renderApp, resetApp, signInFixtureAccount } from "./render";

const RIOT_ORIGINS = new Set<string>(RIOT_CONNECT_HOSTS);

beforeEach(() => {
  resetApp();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("token handling", () => {
  it("never sends the token anywhere except Riot hosts", async () => {
    const leaks: string[] = [];
    let riotCalls = 0;
    const listener = ({ request }: { request: Request }) => {
      const url = new URL(request.url);
      const session = useSessionStore.getState().sessions[0];
      const secrets = session
        ? [session.accessToken, session.entitlementsToken, session.idToken]
        : [];
      const headerText = [...request.headers.entries()].map(([k, v]) => `${k}:${v}`).join("\n");
      const carriesToken =
        request.headers.has("authorization") ||
        request.headers.has("x-riot-entitlements-jwt") ||
        secrets.some((s) => request.url.includes(s) || headerText.includes(s));
      if (RIOT_ORIGINS.has(url.origin)) riotCalls += 1;
      else if (carriesToken) leaks.push(url.origin);
      // Tokens and PUUIDs never go in a non-Riot URL.
      if (!RIOT_ORIGINS.has(url.origin) && session && request.url.includes(session.puuid))
        leaks.push(`${url.origin} (puuid)`);
    };
    server.events.on("request:start", listener);

    await signInFixtureAccount();
    for (const path of ["/dashboard", "/spending", "/stats", "/collection", "/share"]) {
      const { unmount } = renderApp(path);
      await screen.findByRole("heading", { level: 1 }, { timeout: 8000 });
      await new Promise((r) => setTimeout(r, 400));
      unmount();
    }
    server.events.removeListener("request:start", listener);

    expect(riotCalls).toBeGreaterThan(10);
    expect(leaks).toEqual([]);
  });

  it("CSP connect-src matches exactly the hosts the client uses", () => {
    const headers = readFileSync(join(__dirname, "../../public/_headers"), "utf8");
    const csp = /Content-Security-Policy:\s*(.+)/.exec(headers)![1]!;
    const connect = csp
      .split(";")
      .find((d) => d.trim().startsWith("connect-src"))!
      .trim()
      .split(/\s+/)
      .slice(1);
    expect(new Set(connect)).toEqual(
      new Set([
        "'self'",
        "https://valorant-api.com",
        "https://media.valorant-api.com",
        ...RIOT_CONNECT_HOSTS,
      ]),
    );
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(headers).toContain("Referrer-Policy: no-referrer");
    expect(headers).toContain("X-Content-Type-Options: nosniff");
  });

  // Both Vercel configs (Root Directory = repo root or apps/web) must match _headers.
  it.each(["../../../../vercel.json", "../../vercel.json"])(
    "%s sends the same security headers as _headers",
    (file) => {
      const vercel = JSON.parse(readFileSync(join(__dirname, file), "utf8")) as {
        headers: { source: string; headers: { key: string; value: string }[] }[];
      };
      const fromVercel = Object.fromEntries(
        vercel.headers.find((h) => h.source === "/(.*)")!.headers.map((h) => [h.key, h.value]),
      );
      const lines = readFileSync(join(__dirname, "../../public/_headers"), "utf8").split(/\r?\n/);
      const fromPages: Record<string, string> = {};
      let inBlock = false;
      for (const line of lines) {
        if (/^\S/.test(line)) {
          inBlock = line.trim() === "/*";
          continue;
        }
        const m = inBlock ? /^\s+([\w-]+):\s*(.+)$/.exec(line) : null;
        if (m) fromPages[m[1]!] = m[2]!;
      }
      expect(fromVercel).toEqual(fromPages);
    },
  );
});

describe("clear all data", () => {
  it("leaves nothing in storage or IndexedDB", async () => {
    await signInFixtureAccount({ remember: true });
    localStorage.setItem("vv.settings", "{}");
    expect(await loadVault()).toHaveLength(1);
    renderApp("/dashboard");
    await screen.findByText("12,450", {}, { timeout: 8000 });

    await clearAllData();

    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
    expect(useSessionStore.getState().sessions).toHaveLength(0);
    const dbs = await indexedDB.databases();
    expect(dbs.map((d) => d.name)).toEqual([]);
  });

  it("restores a remembered account after a reload, but not a tab-only one", async () => {
    await clearAllData();
    await signInFixtureAccount({ remember: true });
    useSessionStore.getState().reset(); // simulate a new tab: memory and sessionStorage gone
    await useSessionStore.getState().hydrate();
    expect(useSessionStore.getState().sessions).toHaveLength(1);

    await clearAllData();
    await signInFixtureAccount({ remember: false });
    useSessionStore.getState().reset();
    await useSessionStore.getState().hydrate();
    expect(useSessionStore.getState().sessions).toHaveLength(0);
  });
});
