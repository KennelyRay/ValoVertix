import { http, HttpResponse, delay, type HttpHandler } from "msw";
import { ITEM_TYPE } from "@valovertix/riot";
import riot from "./fixtures/riot.json";
import staticData from "./fixtures/static.json";

export const DEMO_PUUID = riot.puuid;
export const DEMO_RIOT_ID = { gameName: riot.gameName, tagLine: riot.tagLine };

const PD = "https://pd.*.a.pvp.net";

const STATIC_PATHS: Record<string, unknown> = {
  "/v1/version": staticData.version,
  "/v1/weapons": staticData.weapons,
  "/v1/contenttiers": staticData.contentTiers,
  "/v1/themes": staticData.themes,
  "/v1/buddies": staticData.buddies,
  "/v1/playercards": staticData.playerCards,
  "/v1/sprays": staticData.sprays,
  "/v1/playertitles": staticData.titles,
  "/v1/agents": staticData.agents,
  "/v1/competitivetiers": staticData.competitiveTiers,
  "/v1/maps": staticData.maps,
  "/v1/currencies": staticData.currencies,
  "/v1/contracts": staticData.contracts,
};

/** Rejects pd requests that lack the Riot headers, like the real service does. */
function authorized(request: Request) {
  return (
    request.headers.get("authorization")?.startsWith("Bearer ") &&
    request.headers.get("x-riot-entitlements-jwt") &&
    request.headers.get("x-riot-clientversion") &&
    request.headers.get("x-riot-clientplatform")
  );
}

const unauthorized = () =>
  HttpResponse.json({ httpStatus: 401, errorCode: "BAD_CLAIMS" }, { status: 401 });

export interface HandlerOptions {
  /** Simulated network latency in ms (demo mode feels more real with a little). */
  latency?: number;
}

export function createHandlers({ latency = 0 }: HandlerOptions = {}): HttpHandler[] {
  const wait = () => (latency ? delay(latency) : Promise.resolve());

  const pd = (path: string, body: (req: Request, params: Record<string, string>) => unknown) =>
    http.get(`${PD}${path}`, async ({ request, params }) => {
      await wait();
      if (!authorized(request)) return unauthorized();
      const data = body(request, params as Record<string, string>);
      return data === undefined
        ? HttpResponse.json({ errorCode: "RESOURCE_NOT_FOUND" }, { status: 404 })
        : HttpResponse.json(data);
    });

  return [
    // ---- Sign-in ----
    http.post("https://entitlements.auth.riotgames.com/api/token/v1", async ({ request }) => {
      await wait();
      if (!request.headers.get("authorization")) return unauthorized();
      return HttpResponse.json({ entitlements_token: "demo.entitlements.token" });
    }),
    http.get("https://auth.riotgames.com/userinfo", async () => {
      await wait();
      return HttpResponse.json({
        sub: riot.puuid,
        acct: { game_name: riot.gameName, tag_line: riot.tagLine },
      });
    }),
    http.put("https://riot-geo.pas.si.riotgames.com/pas/v1/product/valorant", async () => {
      await wait();
      return HttpResponse.json({ token: "x", affinities: { pbe: "na", live: riot.region } });
    }),

    // ---- pd.{shard}.a.pvp.net ----
    pd("/store/v1/entitlements/:puuid/:itemType", (_req, { itemType }) => ({
      ItemTypeID: itemType,
      Entitlements: (riot.entitlements[itemType as keyof typeof riot.entitlements] ?? []).map(
        (ItemID) => ({ TypeID: itemType, ItemID }),
      ),
    })),
    pd("/store/v1/offers/", () => riot.offers),
    pd("/store/v1/wallet/:puuid", () => riot.wallet),
    pd("/personalization/v2/players/:puuid/playerloadout", () => riot.loadout),
    pd("/account-xp/v1/players/:puuid", () => riot.accountXp),
    pd("/mmr/v1/players/:puuid", () => riot.mmr),
    pd("/mmr/v1/players/:puuid/competitiveupdates", () => riot.competitiveUpdates),
    pd("/match-history/v1/history/:puuid", () => riot.matchHistory),
    pd("/match-details/v1/matches/:matchId", (_req, { matchId }) =>
      riot.matches.find((m) => m.matchInfo.matchId === matchId),
    ),
    http.put(`${PD}/name-service/v2/players`, async ({ request }) => {
      await wait();
      if (!authorized(request)) return unauthorized();
      return HttpResponse.json([
        { DisplayName: "", Subject: riot.puuid, GameName: riot.gameName, TagLine: riot.tagLine },
      ]);
    }),

    // ---- valorant-api.com ----
    http.get("https://valorant-api.com/v1/:resource", ({ request }) => {
      const data = STATIC_PATHS[new URL(request.url).pathname];
      return data === undefined
        ? HttpResponse.json({ status: 404 }, { status: 404 })
        : HttpResponse.json({ status: 200, data });
    }),
  ];
}

export { ITEM_TYPE };
