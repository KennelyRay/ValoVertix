/**
 * Phase 0 spike: calls each Riot endpoint straight from the browser and records
 * whether CORS lets the page read the response. A CORS block surfaces as a
 * TypeError with no status. Dev-only; see docs/cors-findings.md.
 */
import { fetchGameVersion } from "@valovertix/assets";
import {
  AUTH_ENDPOINTS,
  ITEM_TYPE,
  PD_PATHS,
  buildPdHeaders,
  parseAccessUrl,
  pdBase,
  type Shard,
} from "@valovertix/riot";

const out = document.getElementById("out")!;
const log = (line: string) => (out.textContent += line + "\n");

async function probe(label: string, url: string, init: RequestInit) {
  try {
    const res = await fetch(url, { ...init, credentials: "omit", referrerPolicy: "no-referrer" });
    log(`ALLOWED  ${res.status}  ${label}`);
    return res;
  } catch {
    log(`BLOCKED  ---  ${label}`);
    return null;
  }
}

document.getElementById("form")!.addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("url") as HTMLTextAreaElement;
  const parsed = parseAccessUrl(input.value);
  input.value = "";
  out.textContent = "";
  if (!parsed.ok) return log(`Invalid URL: ${parsed.error}`);
  const { accessToken, idToken } = parsed.tokens;
  const shard = (document.getElementById("shard") as HTMLSelectElement).value as Shard;
  const auth = { Authorization: `Bearer ${accessToken}` };

  const ent = await probe("POST entitlements", AUTH_ENDPOINTS.entitlements, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: "{}",
  });
  const entitlementsToken = ent?.ok
    ? ((await ent.json()) as { entitlements_token: string }).entitlements_token
    : "";
  const info = await probe("GET userinfo", AUTH_ENDPOINTS.userinfo, { headers: auth });
  const puuid = info?.ok
    ? ((await info.json()) as { sub: string }).sub
    : "00000000-0000-0000-0000-000000000000";
  await probe("PUT riot-geo", AUTH_ENDPOINTS.region, {
    method: "PUT",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
  const clientVersion = (await fetchGameVersion()).riotClientVersion;
  log(`ALLOWED  200  GET valorant-api.com/v1/version`);

  const headers = buildPdHeaders({ accessToken, entitlementsToken, clientVersion });
  const base = pdBase(shard);
  const gets: [string, string][] = [
    ...Object.entries(ITEM_TYPE).map(
      ([k, id]) => [`owned ${k}`, PD_PATHS.ownedItems(puuid, id)] as [string, string],
    ),
    ["offers", PD_PATHS.offers()],
    ["wallet", PD_PATHS.wallet(puuid)],
    ["loadout", PD_PATHS.loadout(puuid)],
    ["account-xp", PD_PATHS.accountXp(puuid)],
    ["mmr", PD_PATHS.mmr(puuid)],
    ["competitive updates", PD_PATHS.competitiveUpdates(puuid)],
    ["match history", PD_PATHS.matchHistory(puuid)],
  ];
  let firstMatch: string | null = null;
  for (const [label, path] of gets) {
    const res = await probe(`GET ${label}`, base + path, { headers });
    if (label === "match history" && res?.ok) {
      firstMatch =
        ((await res.json()) as { History: { MatchID: string }[] }).History[0]?.MatchID ?? null;
    }
  }
  if (firstMatch)
    await probe("GET match details", base + PD_PATHS.matchDetails(firstMatch), { headers });
  await probe("PUT name-service", base + PD_PATHS.names(), {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify([puuid]),
  });
  log("Done. Copy these results into docs/cors-findings.md (they contain no tokens).");
});
