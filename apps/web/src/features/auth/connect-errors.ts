export type ConnectFailure = "rejected" | "network" | "riot_down" | "unexpected";

export class ConnectError extends Error {
  constructor(readonly reason: ConnectFailure) {
    super(reason);
    this.name = "ConnectError";
  }
}

export const CONNECT_ERROR_MESSAGES: Record<ConnectFailure, string> = {
  rejected:
    "Riot didn't accept this URL. It may have expired or been used already. Sign in again and paste a fresh one.",
  network:
    "Couldn't reach Riot. Check your connection. If it keeps failing, the URL may have expired: Riot hides that error from browsers.",
  riot_down: "Riot's servers aren't responding right now. Try again in a few minutes.",
  unexpected: "Riot sent something we didn't expect. Try again, or check back later.",
};
