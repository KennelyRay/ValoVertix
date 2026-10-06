export type ConnectFailure = "rejected" | "network" | "riot_down" | "unexpected";

/** Which sign-in call failed. Shown to the user so failures can be diagnosed. */
export type ConnectStep = "entitlements" | "userinfo" | "version";

export const CONNECT_STEP_LABELS: Record<ConnectStep, string> = {
  entitlements: "entitlements token (entitlements.auth.riotgames.com)",
  userinfo: "account info (auth.riotgames.com/userinfo)",
  version: "game version (valorant-api.com)",
};

export class ConnectError extends Error {
  constructor(
    readonly reason: ConnectFailure,
    readonly step?: ConnectStep,
  ) {
    super(step ? `${reason} at ${step}` : reason);
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

export function connectErrorMessage(err: unknown): string {
  if (!(err instanceof ConnectError)) return CONNECT_ERROR_MESSAGES.unexpected;
  const base = CONNECT_ERROR_MESSAGES[err.reason];
  return err.step ? `${base} (Failed step: ${CONNECT_STEP_LABELS[err.step]}.)` : base;
}
