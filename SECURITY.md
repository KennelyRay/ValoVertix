# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub:
**Security → Report a vulnerability** on this repository
(https://github.com/KennelyRay/ValoVertix/security/advisories/new).

Do not open a public issue for anything that could expose players' tokens or accounts.
Include steps to reproduce and the affected page or file. You'll get a reply as soon as
possible; fixes are released by redeploying the site.

## Scope

In scope: this repository and the site it deploys (the web app, its headers and its
client code). Out of scope: Riot Games' services and valorant-api.com, which ValoVertix only
calls; report issues there to their owners.

## How the app limits damage

ValoVertix has no backend, database or accounts. Riot calls go straight from the browser to
Riot. Defences, in layers:

- **Tokens stay on the device**: in memory or `sessionStorage`, or encrypted with AES-GCM under a
  non-extractable key if "Remember this account" is chosen. They expire with Riot's token
  (about an hour) and "Clear all data" removes everything.
- **Tokens only go to Riot**: the client refuses to attach credentials to any address outside
  Riot's hosts (`packages/riot/src/limits.ts`), and the CSP `connect-src` allows nothing else.
- **No injected code runs**: a strict CSP (`script-src 'self'`, no inline scripts or styles,
  `object-src 'none'`, `base-uri 'self'`, `form-action 'none'`), Trusted Types that refuse raw
  HTML and string scripts, and lint rules that reject `eval`, `innerHTML` and
  `dangerouslySetInnerHTML`.
- **No framing or leaking**: `frame-ancestors 'none'`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`, COOP/CORP, HSTS and a deny-by-default `Permissions-Policy`.
- **Tokens never in URLs, logs or images**: a token that lands in the address bar is removed
  at startup, errors carry endpoint labels instead of URLs, and share cards and links contain
  game item IDs only.
- **Supply chain**: a frozen lockfile, `pnpm audit` in CI, Dependabot updates and CodeQL
  scanning.

No app can promise to be free of vulnerabilities; these layers aim to keep any single mistake
from exposing a player's account.
