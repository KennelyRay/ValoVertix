# ValoVertix

A privacy-first web app for VALORANT players: every skin you own, an **estimated** VP and
Philippine peso value of the collection, wallet balances, and rank and match stats. Players sign
in on Riot's official page and paste the redirect URL; everything runs in the browser.

> Not endorsed by or affiliated with Riot Games. Uses unofficial endpoints that may change.

## Quick start

Requirements: Node 22.12+ and pnpm 11 (`corepack enable`).

```sh
pnpm install
pnpm dev                 # http://localhost:5173, try http://localhost:5173/?demo=1
```

| Command                                        | What it does                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                     | Vite dev server for `apps/web`                                                                                      |
| `pnpm build`                                   | Type-checks and builds `apps/web/dist`                                                                              |
| `pnpm preview`                                 | Serves the build on :4173 **with the production CSP** from `public/_headers`                                        |
| `pnpm test`                                    | Unit and integration tests (Vitest + MSW)                                                                           |
| `pnpm test:coverage`                           | Same, and fails if `packages/calc` drops below 100% coverage                                                        |
| `pnpm e2e`                                     | Playwright against the production build (run `pnpm --filter @valovertix/web exec playwright install chromium` once) |
| `pnpm typecheck` / `pnpm lint` / `pnpm format` | TypeScript, ESLint, Prettier                                                                                        |
| `pnpm gen:fixtures`                            | Regenerates demo and test fixtures from live valorant-api.com data                                                  |
| `pnpm audit`                                   | Dependency audit (also runs in CI)                                                                                  |

## Layout

```
vercel.json         Vercel build settings, SPA rewrite, security headers
apps/web            React SPA (Vite, TanStack Router + Query, Zustand, Tailwind)
  public/_headers   Security headers for Cloudflare Pages and `pnpm preview`
  src/routes        One file per page
  src/features      auth, collection, spending, stats, share, data hooks
  src/config        vp-prices.ts, app.ts
  src/lib           vault (AES-GCM), clear-data, query client, demo, formatters
  src/mocks         MSW handlers + fixtures (used by tests AND demo mode)
  e2e               Playwright tests
  cors-spike.html   Phase 0 CORS test page (dev server only)
packages/riot       Riot endpoints, Zod schemas, access-URL parser, typed client
packages/assets     valorant-api.com client, IndexedDB cache, skin catalog
packages/calc       Pure spending and stats math (100% covered)
docs/cors-findings.md
```

There is no `apps/proxy`. Phase 0 found that every Riot endpoint allows browser requests, so
no proxy is needed; see [docs/cors-findings.md](docs/cors-findings.md).

## How tokens are handled

This is the exact behavior, so the privacy page and this section can be checked against the code.

1. **Sign-in happens on Riot's site.** The "Sign in with Riot" link opens
   `RIOT_AUTHORIZE_URL` (in `packages/riot/src/endpoints.ts`) in a new tab. The password never
   touches this app.
2. **Parsing.** `parseAccessUrl` accepts only `https://playvalorant.com` or
   `https://www.playvalorant.com` with no port or credentials, and a fragment containing
   JWT-shaped `access_token` and `id_token`. Expiry comes from the JWT `exp` claim (falling back
   to `expires_in`). The textarea is cleared immediately after submit, valid or not.
3. **Bootstrap.** The browser calls Riot directly: entitlements token, `userinfo` (PUUID),
   riot-geo (region, with a manual picker if it fails), then valorant-api.com for the client
   version. See `apps/web/src/features/auth/connect.ts`.
4. **Requests.** Every `pd.{shard}.a.pvp.net` call sends exactly four headers
   (`buildPdHeaders`), with `credentials: "omit"` and `referrerPolicy: "no-referrer"`. Error
   messages carry an endpoint label, never a URL, because pd URLs contain the PUUID.
5. **Storage.**
   - Default: the session (tokens, PUUID, shard, Riot ID) lives in memory and in
     `sessionStorage["vv.sessions"]`, so it is gone when the tab closes.
   - "Remember this account": the session is encrypted with AES-GCM (random 12-byte IV per
     save) using a **non-extractable** `CryptoKey` kept in IndexedDB `valovertix-vault`. The
     record stores its expiry; expired or undecryptable records are deleted on load. This
     stops casual inspection, not malware or other users of the same browser profile, and the
     UI says so.
   - Query keys use a random local session ID, never the PUUID.
6. **Expiry and 401.** A one-second watcher ends any session past its `exp`. A 401 from any pd
   query cancels and removes that account's queries, deletes it from the vault, and shows a
   "sign in again" banner. Auth errors are never retried (`shouldRetry` in
   `src/lib/query-client.ts`).
7. **Never in URLs, logs or images.** Tokens and PUUIDs never appear in routes or query strings.
   Schema-drift logs are sanitized to path shapes and Zod issue codes, with UUID keys replaced by
   `{id}`. ESLint forbids `console.log`. The share card shows the Riot ID only if the user opts
   in, and never the PUUID or token.
8. **Network boundary.** The CSP `connect-src` allows only `'self'`, valorant-api.com,
   media.valorant-api.com (PNG export inlines images) and the Riot hosts in
   `RIOT_CONNECT_HOSTS`. A unit test fails if the CSP and that list drift apart, and both an
   integration test and an E2E test assert that no request carrying a token goes to any other
   origin.
9. **Clear all data** cancels queries, empties the query cache, `sessionStorage` and
   `localStorage`, deletes both IndexedDB databases, unregisters service workers and clears
   Cache Storage (`src/lib/clear-data.ts`). The E2E suite checks that nothing remains.

## Updating VP prices

Edit `apps/web/src/config/vp-prices.ts`:

1. Update `VP_PACKS_PHP` with the current packs from the PH store and change the date in the
   comment. The peso range uses the cheapest per-VP pack (low) and the most expensive (high).
2. Update the expected values in `apps/web/src/config/vp-prices.test.ts` and
   `packages/calc/src/currency.test.ts` if the extreme packs changed.
3. Update the capture date shown on the Spending page ("VP packs used for the peso estimate").

To add a currency, add an entry to `VP_PRICES` (symbol, locale, packs). The currency select in
Settings lists every key automatically.

## Demo mode

`/?demo=1` or "Try the demo account" starts the MSW service worker with the same handlers the
tests use (`src/mocks/handlers.ts`). The account is fictional (`Demo Player#DEMO`); its
inventory, prices, ranks and matches come from `src/mocks/fixtures`, generated by
`pnpm gen:fixtures` from real catalog data plus a seeded random account. Signing in for real
stops the worker first, so real requests are never answered by mocks. Queries are held until
boot finishes, so a restored demo session can't reach Riot before the worker is running.

## Deployment

### Vercel (primary)

`vercel.json` at the repo root holds everything Vercel needs: install and build commands
(pinned pnpm 11 via `npx`), the output directory `apps/web/dist`, the SPA rewrite to
`index.html`, and the security headers (CSP, `Referrer-Policy`, `nosniff`, frame blocking).

1. Import the repo in Vercel. **Root Directory** can be the repo root or `apps/web`: each has its
   own `vercel.json` (`/vercel.json` and `apps/web/vercel.json`) with the right install, build and
   output paths. Leave the build settings on their defaults so `vercel.json` controls them.
2. Node.js version: 22.x or newer (Project Settings → Build and Deployment).
3. Optional environment variable `VITE_OFFICIAL_DOMAIN`, e.g. `valovertix.app`, if you use a
   custom domain. Without it, the build uses Vercel's production domain
   (`VERCEL_PROJECT_PRODUCTION_URL`). This domain appears on the guide, privacy page and share
   cards so users can spot clones.
4. Deploy. No serverless functions, databases or secrets are needed.

Static files win over the rewrite on Vercel, so `/assets/*` and `/mockServiceWorker.js` are
served as files and every other path gets the app.

**Keep the headers in sync.** The CSP exists in three files: both `vercel.json` files and
`apps/web/public/_headers` (Cloudflare Pages and `pnpm preview`). A test fails if they differ.

### Cloudflare Pages (alternative)

Build command `pnpm install --frozen-lockfile && pnpm build`, output directory
`apps/web/dist`, `NODE_VERSION=22`. `public/_headers` ships the same headers. With no
`404.html`, Pages serves `index.html` for client-side routes.

### Analytics

Optional and cookieless only. If you enable one, add its script and beacon hosts to
`script-src` and `connect-src` in both header files, and list it on the privacy page.

Before each release, re-check the endpoints with `cors-spike.html` and the commands in
`docs/cors-findings.md`, and verify `RIOT_AUTHORIZE_URL` still works.

## Known gaps

- **Guide screenshots:** `/guide` uses illustrated browser frames with redacted tokens. Replace
  them with real screenshots (with the token redacted) before launch.
- **Lighthouse:** the demo dashboard measured Performance 90 and Accessibility 100 with the
  desktop preset. Under Lighthouse's default mobile throttling it scores about 25–40, almost
  all of it MSW serving roughly 1 MB of fixtures through the service worker on a cold load.
  The landing page scores about 75 on mobile.
- **No logo or favicon** yet (the header uses the product name as text).
