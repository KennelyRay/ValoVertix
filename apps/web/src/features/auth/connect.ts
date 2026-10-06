import { fetchGameVersion } from "@valovertix/assets";
import {
  RiotApiError,
  createRiotClient,
  fetchEntitlementsToken,
  fetchRegion,
  fetchUserInfo,
  regionToShard,
  type AccessTokens,
  type Shard,
} from "@valovertix/riot";
import { CONNECT_ERROR_MESSAGES, ConnectError } from "./connect-errors";
import type { Session } from "./session-store";

export { CONNECT_ERROR_MESSAGES, ConnectError };

export type ConnectResult =
  { status: "ok"; session: Session } | { status: "needs_region"; tokens: AccessTokens };

function toConnectError(err: unknown): ConnectError {
  if (!(err instanceof RiotApiError)) return new ConnectError("unexpected");
  switch (err.kind) {
    case "auth":
    case "forbidden":
    case "bad_request":
      return new ConnectError("rejected");
    case "network":
      return new ConnectError("network");
    case "server":
    case "rate_limit":
      return new ConnectError("riot_down");
    default:
      return new ConnectError("unexpected");
  }
}

/**
 * Turns pasted tokens into a session: entitlements token, PUUID, region
 * and client version. If the region lookup fails and no shard was picked,
 * asks the UI for a manual region instead of guessing.
 */
export async function connectAccount(
  tokens: AccessTokens,
  opts: { shard?: Shard; remember?: boolean; demo?: boolean } = {},
): Promise<ConnectResult> {
  let entitlementsToken: string;
  let user: Awaited<ReturnType<typeof fetchUserInfo>>;
  try {
    [entitlementsToken, user] = await Promise.all([
      fetchEntitlementsToken(tokens.accessToken),
      fetchUserInfo(tokens.accessToken),
    ]);
  } catch (err) {
    throw toConnectError(err);
  }

  let shard = opts.shard ?? null;
  if (!shard) {
    shard = regionToShard(await fetchRegion(tokens.accessToken, tokens.idToken).catch(() => null));
    if (!shard) return { status: "needs_region", tokens };
  }

  let clientVersion: string;
  try {
    clientVersion = (await fetchGameVersion()).riotClientVersion;
  } catch {
    throw new ConnectError("network");
  }

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
