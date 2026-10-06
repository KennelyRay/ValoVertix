import { CLIENT_PLATFORM } from "./endpoints";

export interface PdCredentials {
  accessToken: string;
  entitlementsToken: string;
  clientVersion: string;
}

/** The four headers every pd.{shard}.a.pvp.net request needs, and nothing else. */
export function buildPdHeaders(creds: PdCredentials): Record<string, string> {
  return {
    Authorization: `Bearer ${creds.accessToken}`,
    "X-Riot-Entitlements-JWT": creds.entitlementsToken,
    "X-Riot-ClientVersion": creds.clientVersion,
    "X-Riot-ClientPlatform": CLIENT_PLATFORM,
  };
}
