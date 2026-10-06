/** Builds an unsigned JWT-shaped string for tests and demo mode. */
export function fakeJwt(payload: Record<string, unknown>): string {
  const enc = (v: unknown) =>
    btoa(JSON.stringify(v)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${enc({ alg: "none", typ: "JWT" })}.${enc(payload)}.sig`;
}

export function fakeAccessUrl(opts: { exp: number; host?: string; expiresIn?: number }): string {
  const access = fakeJwt({ sub: "test", exp: opts.exp });
  const id = fakeJwt({ sub: "test", exp: opts.exp });
  const hash = new URLSearchParams({
    access_token: access,
    scope: "account openid",
    iss: "https://auth.riotgames.com",
    id_token: id,
    token_type: "Bearer",
    session_state: "x",
    expires_in: String(opts.expiresIn ?? 3600),
  });
  return `https://${opts.host ?? "playvalorant.com"}/en-us/opt_in/#${hash.toString()}`;
}
