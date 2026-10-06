/**
 * Every Riot host, path and ID the app uses. Nothing outside this file should
 * hard-code a Riot URL.
 *
 * Verified 2026-10-05 against the valapidocs source
 * (github.com/techchrism/valorant-api-docs) and live CORS preflights.
 * See docs/cors-findings.md.
 */

/** Riot's official sign-in page. Verify before each release. */
export const RIOT_AUTHORIZE_URL =
  "https://auth.riotgames.com/authorize?redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in&client_id=play-valorant-web-prod&response_type=token%20id_token&nonce=1&scope=account%20openid";

/** Hosts the pasted access URL may come from. */
export const ACCESS_URL_HOSTS = ["playvalorant.com", "www.playvalorant.com"] as const;

export const AUTH_ENDPOINTS = {
  entitlements: "https://entitlements.auth.riotgames.com/api/token/v1",
  userinfo: "https://auth.riotgames.com/userinfo",
  region: "https://riot-geo.pas.si.riotgames.com/pas/v1/product/valorant",
} as const;

export const SHARDS = ["na", "eu", "ap", "kr"] as const;
export type Shard = (typeof SHARDS)[number];

export const pdBase = (shard: Shard) => `https://pd.${shard}.a.pvp.net`;

/** Hosts the browser talks to directly. Mirrors connect-src in public/_headers. */
export const RIOT_CONNECT_HOSTS = [
  "https://auth.riotgames.com",
  "https://entitlements.auth.riotgames.com",
  "https://riot-geo.pas.si.riotgames.com",
  ...SHARDS.map(pdBase),
] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string) => UUID_RE.test(value);

/** Guards path segments so a malformed ID can never change the request path. */
const seg = (value: string) => {
  if (!isUuid(value)) throw new TypeError("Expected a UUID path segment");
  return value;
};

const range = (start: number, end: number) => {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start) {
    throw new RangeError("Invalid page range");
  }
  return `startIndex=${start}&endIndex=${end}`;
};

export const PD_PATHS = {
  ownedItems: (puuid: string, itemTypeId: string) =>
    `/store/v1/entitlements/${seg(puuid)}/${seg(itemTypeId)}`,
  offers: () => "/store/v1/offers/",
  /** POST with body {}. Daily shop, featured bundles and Night Market, with prices. */
  storefront: (puuid: string) => `/store/v3/storefront/${seg(puuid)}`,
  wallet: (puuid: string) => `/store/v1/wallet/${seg(puuid)}`,
  loadout: (puuid: string) => `/personalization/v2/players/${seg(puuid)}/playerloadout`,
  accountXp: (puuid: string) => `/account-xp/v1/players/${seg(puuid)}`,
  mmr: (puuid: string) => `/mmr/v1/players/${seg(puuid)}`,
  competitiveUpdates: (puuid: string, start = 0, end = 20) =>
    `/mmr/v1/players/${seg(puuid)}/competitiveupdates?${range(start, end)}&queue=competitive`,
  matchHistory: (puuid: string, start = 0, end = 20) =>
    `/match-history/v1/history/${seg(puuid)}?${range(start, end)}`,
  matchDetails: (matchId: string) => `/match-details/v1/matches/${seg(matchId)}`,
  names: () => "/name-service/v2/players",
} as const;

export const ITEM_TYPE = {
  skinLevel: "e7c63390-eda7-46e0-bb7a-a6abdacd2433",
  skinChroma: "3ad1b2b2-acdb-4524-852f-954a76ddae0a",
  agent: "01bb38e1-da47-4e6a-9b3d-945fe4655707",
  buddy: "dd3bf334-87f3-40bd-b043-682a57a8dc3a",
  spray: "d5f120f8-ff8c-4aac-92ea-f2b5acbe9475",
  playerCard: "3f296c07-64c3-494c-923b-fe692a4fa1bd",
  title: "de7caa6b-adf7-4588-bbd1-143831e786c6",
} as const;
export type ItemTypeKey = keyof typeof ITEM_TYPE;

/** Currency IDs, cross-checked with valorant-api.com /v1/currencies. */
export const CURRENCY = {
  vp: "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741",
  radianite: "e59aa87c-4cbf-517a-5983-6e81511be9b7",
  kingdomCredits: "85ca954a-41f2-ce94-9b45-8ca3dd39a00d",
} as const;

/**
 * Standard X-Riot-ClientPlatform value: base64 of
 * {"platformType":"PC","platformOS":"Windows","platformOSVersion":"10.0.19042.1.256.64bit","platformChipset":"Unknown"}
 * with the CRLF/tab formatting the game client sends.
 */
export const CLIENT_PLATFORM =
  "ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9";

export const COMPETITIVE_QUEUE = "competitive";
