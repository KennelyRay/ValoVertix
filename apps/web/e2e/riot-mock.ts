import type { Page, Request, Route } from "@playwright/test";
import riot from "../src/mocks/fixtures/riot.json" with { type: "json" };
import staticData from "../src/mocks/fixtures/static.json" with { type: "json" };
import { fakeAccessUrl } from "../../../packages/riot/src/test-utils";

export const RIOT_ORIGINS = [
  "https://auth.riotgames.com",
  "https://entitlements.auth.riotgames.com",
  "https://riot-geo.pas.si.riotgames.com",
  "https://pd.na.a.pvp.net",
  "https://pd.eu.a.pvp.net",
  "https://pd.ap.a.pvp.net",
  "https://pd.kr.a.pvp.net",
];

const STATIC: Record<string, unknown> = {
  "/v1/version": staticData.version,
  "/v1/weapons": staticData.weapons,
  "/v1/contenttiers": staticData.contentTiers,
  "/v1/themes": staticData.themes,
  "/v1/bundles": staticData.bundles,
  "/v1/buddies": staticData.buddies,
  "/v1/playercards": staticData.playerCards,
  "/v1/levelborders": staticData.levelBorders,
  "/v1/sprays": staticData.sprays,
  "/v1/playertitles": staticData.titles,
  "/v1/agents": staticData.agents,
  "/v1/competitivetiers": staticData.competitiveTiers,
  "/v1/maps": staticData.maps,
  "/v1/currencies": staticData.currencies,
  "/v1/contracts": staticData.contracts,
};

// The browser makes real CORS requests, so mocked responses must carry the same headers Riot sends.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET, POST, PUT",
};
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    headers: CORS,
    body: JSON.stringify(body),
  });

function pdBody(path: string): unknown {
  const ent = /^\/store\/v1\/entitlements\/[^/]+\/([^/]+)$/.exec(path);
  if (ent) {
    const type = ent[1]!;
    const ids = (riot.entitlements as Record<string, string[]>)[type] ?? [];
    return { ItemTypeID: type, Entitlements: ids.map((ItemID) => ({ TypeID: type, ItemID })) };
  }
  if (path === "/store/v1/offers/") return riot.offers;
  if (path.startsWith("/store/v3/storefront/")) return riot.storefront;
  if (path.startsWith("/store/v1/wallet/")) return riot.wallet;
  if (path.endsWith("/playerloadout")) return riot.loadout;
  if (path.startsWith("/account-xp/")) return riot.accountXp;
  if (path.endsWith("/competitiveupdates")) return riot.competitiveUpdates;
  if (path.startsWith("/mmr/")) return riot.mmr;
  if (path.startsWith("/match-history/")) return riot.matchHistory;
  const match = /^\/match-details\/v1\/matches\/(.+)$/.exec(path);
  if (match) return riot.matches.find((m) => m.matchInfo.matchId === match[1]);
  if (path === "/name-service/v2/players")
    return [{ Subject: riot.puuid, GameName: riot.gameName, TagLine: riot.tagLine }];
  return undefined;
}

/** Serves Riot and valorant-api.com from fixtures at the network layer (no MSW). */
export async function mockRiot(page: Page, onRequest?: (req: Request) => void) {
  await page.route(
    /^https:\/\/(auth|entitlements\.auth|riot-geo\.pas\.si)\.riotgames\.com\/|^https:\/\/pd\.(na|eu|ap|kr)\.a\.pvp\.net\/|^https:\/\/valorant-api\.com\//,
    async (route) => {
      const req = route.request();
      onRequest?.(req);
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      const url = new URL(req.url());
      if (url.hostname === "valorant-api.com") {
        // Landing showcase: single skins by UUID. Serve a fixture skin under the requested UUID.
        const single = url.pathname.match(/^\/v1\/weapons\/skins\/([^/]+)$/);
        if (single) {
          const skins = staticData.weapons.flatMap(
            (w) => w.skins as { uuid: string; displayIcon: string | null }[],
          );
          const skin = skins.find((s) => s.uuid === single[1]) ?? skins.find((s) => s.displayIcon);
          return json(route, { status: 200, data: { ...skin, uuid: single[1] } });
        }
        const data = STATIC[url.pathname];
        return data === undefined
          ? json(route, { status: 404 }, 404)
          : json(route, { status: 200, data });
      }
      if (url.hostname === "entitlements.auth.riotgames.com")
        return json(route, { entitlements_token: "e2e.entitlements.token" });
      if (url.pathname === "/userinfo")
        return json(route, {
          sub: riot.puuid,
          acct: { game_name: riot.gameName, tag_line: riot.tagLine },
        });
      if (url.hostname.startsWith("riot-geo"))
        return json(route, { token: "x", affinities: { pbe: "na", live: "ap" } });
      if (!req.headers()["authorization"]) return json(route, {}, 401);
      const body = pdBody(url.pathname);
      return body === undefined ? json(route, {}, 404) : json(route, body);
    },
  );
}

export const freshAccessUrl = () => fakeAccessUrl({ exp: Math.floor(Date.now() / 1000) + 3600 });
export const FIXTURE_RIOT_ID = `${riot.gameName}#${riot.tagLine}`;
