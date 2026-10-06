const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;

export const looksLikeJwt = (token: string) => JWT_RE.test(token);

function base64UrlDecode(part: string): string {
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Decodes a JWT payload without verifying it. Only used to read `exp`. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  if (!looksLikeJwt(token)) return null;
  try {
    const payload: unknown = JSON.parse(base64UrlDecode(token.split(".")[1] ?? ""));
    return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Expiry in epoch milliseconds, or null when the token has no numeric `exp`. */
export function jwtExpiry(token: string): number | null {
  const exp = decodeJwtPayload(token)?.exp;
  return typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : null;
}
