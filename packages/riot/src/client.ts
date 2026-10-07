import type { z } from "zod";
import { reportDrift, sanitizeIssues } from "./drift";
import {
  AUTH_ENDPOINTS,
  ITEM_TYPE,
  PD_PATHS,
  pdBase,
  type ItemTypeKey,
  type Shard,
} from "./endpoints";
import { RiotApiError, kindForStatus, parseRetryAfter } from "./errors";
import { buildPdHeaders } from "./headers";
import {
  accountXpSchema,
  competitiveUpdatesSchema,
  entitlementsTokenSchema,
  loadoutSchema,
  matchDetailsSchema,
  matchHistorySchema,
  mmrSchema,
  namesSchema,
  offersSchema,
  ownedItemsSchema,
  regionSchema,
  storefrontSchema,
  userInfoSchema,
  walletSchema,
} from "./schemas";

type FetchLike = typeof fetch;

interface RequestOptions {
  method?: "GET" | "POST" | "PUT";
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal | undefined;
  fetch?: FetchLike;
}

async function request<S extends z.ZodType>(
  endpoint: string,
  url: string,
  schema: S,
  opts: RequestOptions = {},
): Promise<z.output<S>> {
  const doFetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
  let res: Response;
  try {
    res = await doFetch(url, {
      method: opts.method ?? "GET",
      headers: {
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : null,
      signal: opts.signal ?? null,
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new RiotApiError("network", endpoint);
  }

  if (!res.ok) {
    throw new RiotApiError(kindForStatus(res.status), endpoint, {
      status: res.status,
      retryAfterMs: parseRetryAfter(res.headers.get("Retry-After")),
    });
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch (err) {
    // A request cancelled mid-download is not a broken response.
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new RiotApiError("schema", endpoint, {
      issues: [{ source: endpoint, path: "(root)", code: "invalid_json" }],
    });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issues = sanitizeIssues(endpoint, parsed.error.issues);
    reportDrift(issues);
    throw new RiotApiError("schema", endpoint, { issues });
  }
  return parsed.data;
}

// ---- Sign-in calls -------------------------------------------------------

export const fetchEntitlementsToken = (accessToken: string, f?: FetchLike) =>
  request("auth.entitlements", AUTH_ENDPOINTS.entitlements, entitlementsTokenSchema, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: {},
    ...(f && { fetch: f }),
  }).then((r) => r.entitlements_token);

export const fetchUserInfo = (accessToken: string, f?: FetchLike) =>
  request("auth.userinfo", AUTH_ENDPOINTS.userinfo, userInfoSchema, {
    headers: { Authorization: `Bearer ${accessToken}` },
    ...(f && { fetch: f }),
  });

export const fetchRegion = (accessToken: string, idToken: string, f?: FetchLike) =>
  request("auth.region", AUTH_ENDPOINTS.region, regionSchema, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: { id_token: idToken },
    ...(f && { fetch: f }),
  }).then((r) => r.affinities.live);

// ---- Game data calls -----------------------------------------------------

export interface RiotSession {
  accessToken: string;
  entitlementsToken: string;
  clientVersion: string;
  puuid: string;
  shard: Shard;
}

export type RiotClient = ReturnType<typeof createRiotClient>;

export function createRiotClient(session: RiotSession, f?: FetchLike) {
  const base = pdBase(session.shard);
  const headers = buildPdHeaders(session);
  const pd = <S extends z.ZodType>(
    endpoint: string,
    path: string,
    schema: S,
    opts: Omit<RequestOptions, "headers" | "fetch"> = {},
  ) => request(endpoint, base + path, schema, { ...opts, headers, ...(f && { fetch: f }) });

  const { puuid } = session;
  return {
    ownedItems: (type: ItemTypeKey, signal?: AbortSignal) =>
      pd(`store.owned.${type}`, PD_PATHS.ownedItems(puuid, ITEM_TYPE[type]), ownedItemsSchema, {
        signal,
      }),
    offers: (signal?: AbortSignal) =>
      pd("store.offers", PD_PATHS.offers(), offersSchema, { signal }).then((r) => r.Offers),
    storefront: (signal?: AbortSignal) =>
      pd("store.storefront", PD_PATHS.storefront(puuid), storefrontSchema, {
        method: "POST",
        body: {},
        signal,
      }),
    wallet: (signal?: AbortSignal) =>
      pd("store.wallet", PD_PATHS.wallet(puuid), walletSchema, { signal }).then((r) => r.Balances),
    loadout: (signal?: AbortSignal) =>
      pd("player.loadout", PD_PATHS.loadout(puuid), loadoutSchema, { signal })
        .catch((err: unknown) => {
          // Older shards may still only serve v2.
          if (err instanceof RiotApiError && err.kind === "not_found") {
            return pd("player.loadout", PD_PATHS.loadoutV2(puuid), loadoutSchema, { signal });
          }
          throw err;
        })
        // Identity fields at the top level (card, title, level) plus the equipped guns.
        .then((r) => ({ ...r.Identity, Guns: r.Guns ?? [] })),
    accountXp: (signal?: AbortSignal) =>
      pd("player.xp", PD_PATHS.accountXp(puuid), accountXpSchema, { signal }).then(
        (r) => r.Progress,
      ),
    mmr: (signal?: AbortSignal) => pd("player.mmr", PD_PATHS.mmr(puuid), mmrSchema, { signal }),
    competitiveUpdates: (signal?: AbortSignal) =>
      pd("player.compUpdates", PD_PATHS.competitiveUpdates(puuid), competitiveUpdatesSchema, {
        signal,
      }).then((r) => r.Matches),
    matchHistory: (signal?: AbortSignal) =>
      pd("player.matchHistory", PD_PATHS.matchHistory(puuid), matchHistorySchema, { signal }),
    matchDetails: (matchId: string, signal?: AbortSignal) =>
      pd("match.details", PD_PATHS.matchDetails(matchId), matchDetailsSchema, { signal }),
    names: (puuids: string[], signal?: AbortSignal) =>
      pd("player.names", PD_PATHS.names(), namesSchema, { method: "PUT", body: puuids, signal }),
  };
}
