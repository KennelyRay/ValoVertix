import { ACCESS_URL_HOSTS } from "./endpoints";
import { jwtExpiry, looksLikeJwt } from "./jwt";

export interface AccessTokens {
  accessToken: string;
  idToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

export type AccessUrlError =
  | "empty"
  | "too_long"
  | "not_url"
  | "wrong_host"
  | "missing_tokens"
  | "malformed_token"
  | "expired";

/** Real redirect URLs are about 3,000 characters; anything far past that is not one. */
export const MAX_ACCESS_URL_LENGTH = 8192;

export type AccessUrlResult =
  { ok: true; tokens: AccessTokens } | { ok: false; error: AccessUrlError };

export const ACCESS_URL_ERROR_MESSAGES: Record<AccessUrlError, string> = {
  empty: "Paste the full address from your browser's address bar.",
  too_long: "That's far longer than a sign-in address. Copy just the URL from the address bar.",
  not_url: "That doesn't look like a web address. Copy the whole URL, starting with https://",
  wrong_host:
    "This URL isn't from playvalorant.com. Only paste the page Riot sends you to after signing in.",
  missing_tokens:
    "This URL is missing the sign-in details. Make sure you copied it right after Riot redirected you.",
  malformed_token:
    "The sign-in details in this URL look damaged. Sign in again and copy a fresh URL.",
  expired: "This URL has already expired. Sign in again to get a fresh one.",
};

/**
 * Parses the playvalorant.com redirect URL Riot sends after sign-in.
 * Rejects anything that isn't https on an allowed host with a token fragment.
 */
export function parseAccessUrl(input: string, now = Date.now()): AccessUrlResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "empty" };
  if (raw.length > MAX_ACCESS_URL_LENGTH) return { ok: false, error: "too_long" };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "not_url" };
  }

  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    !(ACCESS_URL_HOSTS as readonly string[]).includes(host)
  ) {
    return { ok: false, error: "wrong_host" };
  }

  const params = new URLSearchParams(url.hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  const idToken = params.get("id_token");
  const tokenType = params.get("token_type");
  if (!accessToken || !idToken) return { ok: false, error: "missing_tokens" };
  if (tokenType !== null && tokenType.toLowerCase() !== "bearer") {
    return { ok: false, error: "malformed_token" };
  }
  if (!looksLikeJwt(accessToken) || !looksLikeJwt(idToken)) {
    return { ok: false, error: "malformed_token" };
  }

  const expiresIn = Number(params.get("expires_in"));
  const expiresAt =
    jwtExpiry(accessToken) ??
    (Number.isFinite(expiresIn) && expiresIn > 0 ? now + expiresIn * 1000 : null);
  if (expiresAt === null) return { ok: false, error: "malformed_token" };
  if (expiresAt <= now) return { ok: false, error: "expired" };

  return { ok: true, tokens: { accessToken, idToken, expiresAt } };
}
