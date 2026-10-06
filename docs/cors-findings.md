# Phase 0: CORS findings

**Result: every Riot endpoint ValoVertix uses allows cross-origin requests from a browser.
No proxy is needed, so `apps/proxy` was not built.** All Riot calls go straight from the
user's browser to Riot.

Tested 2026-10-05 against live Riot servers.

## Method

1. **Preflight probe (no token needed).** A browser sends an `OPTIONS` preflight before any
   request that carries `Authorization` or `X-Riot-*` headers. The browser lets the real
   request through only if the preflight response allows the page's origin, method and
   headers. We sent those preflights with `curl`, using the exact methods and headers the
   app sends, from three origins (`https://valovertix.pages.dev`, `http://localhost:5173`,
   and an unrelated origin).
2. **Unauthenticated real request.** We sent the real request without a token to see
   whether error responses also carry CORS headers.
3. **In-browser spike page.** `apps/web/cors-spike.html` (dev only: `pnpm dev`, then open
   `/cors-spike.html`) runs every call with a real access URL and prints ALLOWED or
   BLOCKED per endpoint. Re-run it before each release, since Riot can change CORS at any time.

## Results

| Endpoint                                                          | Method | Preflight `Access-Control-Allow-Origin` | Allowed headers                      | Result                          |
| ----------------------------------------------------------------- | ------ | --------------------------------------- | ------------------------------------ | ------------------------------- |
| `entitlements.auth.riotgames.com/api/token/v1`                    | POST   | `*`                                     | Authorization, Content-Type          | Allowed                         |
| `auth.riotgames.com/userinfo`                                     | GET    | `*`                                     | Authorization                        | Allowed                         |
| `riot-geo.pas.si.riotgames.com/pas/v1/product/valorant`           | PUT    | echoes the request origin               | Content-Type, api_key, Authorization | Allowed                         |
| `pd.{na,eu,ap,kr}.a.pvp.net/store/v1/entitlements/{puuid}/{type}` | GET    | `*`                                     | echoes requested headers             | Allowed                         |
| `pd.*/store/v1/offers/`                                           | GET    | `*`                                     | echoes                               | Allowed                         |
| `pd.*/store/v1/wallet/{puuid}`                                    | GET    | `*`                                     | echoes                               | Allowed                         |
| `pd.*/personalization/v2/players/{puuid}/playerloadout`           | GET    | `*`                                     | echoes                               | Allowed                         |
| `pd.*/account-xp/v1/players/{puuid}`                              | GET    | `*`                                     | echoes                               | Allowed                         |
| `pd.*/mmr/v1/players/{puuid}`                                     | GET    | `*`                                     | echoes                               | Allowed                         |
| `pd.*/mmr/v1/players/{puuid}/competitiveupdates`                  | GET    | `*`                                     | echoes                               | Allowed                         |
| `pd.*/match-history/v1/history/{puuid}`                           | GET    | `*`                                     | echoes                               | Allowed                         |
| `pd.*/match-details/v1/matches/{matchId}`                         | GET    | `*`                                     | echoes                               | Allowed                         |
| `pd.*/name-service/v2/players`                                    | PUT    | `*`                                     | echoes                               | Allowed                         |
| `valorant-api.com/v1/*`                                           | GET    | `*`                                     | n/a                                  | Allowed                         |
| `media.valorant-api.com/*`                                        | GET    | `*`                                     | n/a                                  | Allowed (needed for PNG export) |

All four pd shards (na, eu, ap, kr) gave identical results.

## Caveat that affects error handling

Error responses from `auth.riotgames.com` and `entitlements.auth.riotgames.com` (401, 400)
**do not** include `Access-Control-Allow-Origin`, and neither does riot-geo's 401. The browser
therefore reports an expired or rejected token on those endpoints as a generic network error,
not as a 401. The sign-in code treats a network failure during sign-in as "couldn't reach Riot,
or the URL may have expired" (see `CONNECT_ERROR_MESSAGES` in `apps/web/src/features/auth/connect.ts`).
pd error responses do include `Access-Control-Allow-Origin: *`, so 401/403/404/429/5xx are
readable there and drive the in-app banners.

## Endpoint verification

valapidocs.techchair.net was unreachable (DNS failure) on 2026-10-05, so shapes were checked
against its source repository, `github.com/techchrism/valorant-api-docs`
(`valorant-api-types/src/endpoints/**`). Differences from the build brief:

- **Owned items.** The docs only show the `EntitlementsByTypes` shape (all types at once).
  Per-type calls return `{ ItemTypeID, Entitlements }`. The schema accepts both.
- **Bundles.** valorant-api.com bundles have no link to the skins they contain, so the
  "bundle" filter and breakdown use the skin's theme (`themeUuid`), labelled "Collection".
- **Free skins.** Battle pass and agent contract skins are identified from
  valorant-api.com `/v1/contracts` (`EquippableSkinLevel` rewards), not guessed from names.
- **Currencies.** Radianite is `e59aa87c-4cbf-517a-5983-6e81511be9b7`, Kingdom Credits
  `85ca954a-41f2-ce94-9b45-8ca3dd39a00d` (from `/v1/currencies`).
- **Videos.** Skin preview videos are served from `valorant.dyn.riotcdn.net`, so the CSP has a
  `media-src` entry for it.
- **Client platform.** The standard base64 blob in `packages/riot/src/endpoints.ts` decodes to
  `{"platformType":"PC","platformOS":"Windows","platformOSVersion":"10.0.19042.1.256.64bit","platformChipset":"Unknown"}`.

## Re-checking

```sh
O=https://valovertix.pages.dev
curl -si -X OPTIONS https://pd.ap.a.pvp.net/store/v1/offers/ \
  -H "Origin: $O" -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,x-riot-entitlements-jwt,x-riot-clientversion,x-riot-clientplatform" \
  | grep -i access-control
```

If any endpoint stops returning an allowed origin, build the stateless Worker described in the
brief for that endpoint only, add its origin to `connect-src`, and list it on `/privacy`.

## Update 2026-10-07: real-account findings

Testing with a real account (playvalorant.com access URL, AP shard) found two endpoints that
behave differently from the docs:

- **`GET auth.riotgames.com/userinfo` returns 404** for these tokens. The 404 has no CORS
  headers, so the browser reports a network error. The app now reads the PUUID (`sub`) and
  Riot ID (`acct` in the id_token) from the tokens themselves and only calls `/userinfo` as a
  fallback (`identityFromTokens` in `packages/riot/src/jwt.ts`).
- **`GET pd.{shard}.a.pvp.net/store/v1/offers/` returns 404**, so the full price list is not
  available. Every other pd endpoint works. The app falls back in two steps:
  1. `POST /store/v3/storefront/{puuid}` (body `{}`, CORS allowed): exact prices for the
     skins currently on sale (daily shop, every item in the featured bundles at its base price,
     Night Market at the undiscounted price).
  2. Every other skin is priced at its tier's standard list price
     (`apps/web/src/config/tier-prices.ts`). The UI says how many skins have exact prices.

  If `/store/v1/offers/` starts working again, exact prices for everything return automatically.
