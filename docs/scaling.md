# How ValoVertix handles traffic

ValoVertix is a static single-page app. There is no application server, database or API of
our own, so there is nothing of ours that gets slower as more people use it.

## Where each request goes

| Request                            | Served by                                                                 | Scales with                                                         |
| ---------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| HTML, JS, CSS, fonts, brand images | Vercel's CDN (static files)                                               | The CDN, globally cached                                            |
| Riot account data                  | Riot's servers, straight from each player's browser                       | Riot, per player (each player uses their own token and rate limits) |
| Game data and art                  | valorant-api.com, then cached in the browser's IndexedDB per game version | One download per game patch per browser                             |

A traffic spike means more CDN hits for static files, which is what CDNs are built for. Riot
traffic is split across players' own browsers and tokens, so one busy day doesn't share a
rate limit between everyone.

## What the app does to stay light

- **Long-lived caching**: built files are content-hashed and served with
  `Cache-Control: public, max-age=31536000, immutable`; the HTML is revalidated on each
  visit so deploys roll out at once. Brand images cache for a week.
- **Stable vendor chunks**: React, the router, motion, zod and icons are separate chunks, so a
  deploy only invalidates the app's own code (about 52 KB gzipped for the entry).
- **Route splitting**: each page loads its own chunk on demand; the demo data (about 240 KB
  gzipped) loads only in demo mode.
- **Fewer Riot calls**: TanStack Query shares and caches results across pages, finished matches
  are never refetched, and at most 6 Riot requests run at once per tab
  (`packages/riot/src/limits.ts`), queueing the rest instead of tripping rate limits.
- **No pile-ups**: every Riot request times out after 20 seconds; 429 responses are retried
  with the `Retry-After` delay and shown to the player.
- **Third-party outages**: game data is cached per game version in IndexedDB. If valorant-api.com
  is down, the last known version is used, so a returning player still sees their data.
- **Rendering**: long skin grids are virtualised or skip off-screen rendering
  (`content-visibility`), and connections to valorant-api.com are opened early (`preconnect`).

## Limits worth knowing

- **Riot's own rate limits** apply per player. Heavy use of one account (many tabs, fast
  refreshing) can still get 429s; the app backs off and says so.
- **valorant-api.com** is a community service. A first-time visitor during its outage can't load
  game data, because there's nothing cached yet.
- **Unofficial endpoints** can change without notice; schema checks report drift instead of
  crashing.
