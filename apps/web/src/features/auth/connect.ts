import { fetchGameVersion } from "@valovertix/assets";
import {
  RiotApiError,
  createRiotClient,
  fetchEntitlementsToken,
  fetchRegion,
  fetchUserInfo,
  identityFromTokens,
  regionToShard,
  type AccessTokens,
  type Shard,
} from "@valovertix/riot";
import { CONNECT_ERROR_MESSAGES, ConnectError, type ConnectStep } from "./connect-errors";
import type { Session } from "./session-store";

export { CONNECT_ERROR_MESSAGES, ConnectError };

export type ConnectResult =
  { status: "ok"; session: Session } | { status: "needs_region"; tokens: AccessTokens };

function toConnectError(err: unknown, step: ConnectStep): ConnectError {
  const kind = err instanceof RiotApiError ? err.kind : "unknown";
  // Sanitized: step and error kind only, never the token.
  console.warn(`[ValoVertix] Sign-in failed at ${step}: ${kind}`);
  switch (kind) {
    case "auth":
    case "forbidden":
    case "bad_request":
      return new ConnectError("rejected", step);
    case "network":
      return new ConnectError("network", step);
    case "server":
    case "rate_limit":
      return new ConnectError("riot_down", step);
    default:
      return new ConnectError("unexpected", step);
  }
}

/** Runs one sign-in call and tags any failure with its step. */
const step = <T>(name: ConnectStep, call: Promise<T>): Promise<T> =>
  call.catch((err: unknown) => {
    throw toConnectError(err, name);
  });

/**
 * Turns pasted tokens into a session: entitlements token, PUUID, region
 * and client version. If the region lookup fails and no shard was picked,
 * asks the UI for a manual region instead of guessing.
 */
export async function connectAccount(
  tokens: AccessTokens,
  opts: { shard?: Shard; remember?: boolean; demo?: boolean } = {},
): Promise<ConnectResult> {
  // The PUUID and Riot ID are claims in the pasted tokens. /userinfo is only a
  // fallback: it returns 404 for some tokens from the playvalorant.com flow.
  const fromTokens = identityFromTokens(tokens.accessToken, tokens.idToken);
  const user = fromTokens.puuid
    ? {
        sub: fromTokens.puuid,
        acct: fromTokens.riotId && {
          game_name: fromTokens.riotId.gameName,
          tag_line: fromTokens.riotId.tagLine,
        },
      }
    : await step("userinfo", fetchUserInfo(tokens.accessToken));
  // Sequential on purpose: when a call fails, the error names that exact call.
  const entitlementsToken = await step("entitlements", fetchEntitlementsToken(tokens.accessToken));

  let shard = opts.shard ?? null;
  if (!shard) {
    shard = regionToShard(await fetchRegion(tokens.accessToken, tokens.idToken).catch(() => null));
    if (!shard) return { status: "needs_region", tokens };
  }

  const clientVersion = (
    await step(
      "version",
      fetchGameVersion().catch(() => {
        throw new RiotApiError("network", "static.version");
      }),
    )
  ).riotClientVersion;

  let riotId =
    user.acct?.game_name && user.acct.tag_line
      ? { gameName: user.acct.game_name, tagLine: user.acct.tag_line }
      : null;
  if (!riotId) {
    const client = createRiotClient({
      ...tokens,
      entitlementsToken,
      clientVersion,
      puuid: user.sub,
      shard,
    });
    const names = await client.names([user.sub]).catch(() => []);
    const me = names[0];
    if (me?.GameName) riotId = { gameName: me.GameName, tagLine: me.TagLine };
  }

  return {
    status: "ok",
    session: {
      id: crypto.randomUUID(),
      accessToken: tokens.accessToken,
      idToken: tokens.idToken,
      entitlementsToken,
      expiresAt: tokens.expiresAt,
      puuid: user.sub,
      shard,
      shardPicked: Boolean(opts.shard),
      clientVersion,
      riotId,
      remembered: Boolean(opts.remember) && !opts.demo,
      demo: Boolean(opts.demo),
    },
  };
}
