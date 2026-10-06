import { describe, expect, it } from "vitest";
import { parseAccessUrl } from "./access-url";
import { decodeJwtPayload, identityFromTokens, jwtExpiry } from "./jwt";
import { fakeAccessUrl, fakeJwt } from "./test-utils";

const NOW = 1_790_000_000_000;
const exp = NOW / 1000 + 3600;

describe("parseAccessUrl", () => {
  it("accepts a valid playvalorant.com redirect", () => {
    const result = parseAccessUrl(fakeAccessUrl({ exp }), NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tokens.expiresAt).toBe(exp * 1000);
      expect(result.tokens.accessToken.split(".")).toHaveLength(3);
      expect(result.tokens.idToken.split(".")).toHaveLength(3);
    }
  });

  it("accepts the www host and surrounding whitespace", () => {
    const result = parseAccessUrl(
      `  ${fakeAccessUrl({ exp, host: "www.playvalorant.com" })}\n`,
      NOW,
    );
    expect(result.ok).toBe(true);
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["not a url", "not_url"],
    ["playvalorant.com/#access_token=x", "not_url"],
  ])("rejects malformed input %j", (input, error) => {
    expect(parseAccessUrl(input, NOW)).toEqual({ ok: false, error });
  });

  it.each([
    "playvalorant.com.evil.example",
    "evil.example",
    "auth.riotgames.com",
    "xplayvalorant.com",
  ])("rejects wrong host %s", (host) => {
    expect(parseAccessUrl(fakeAccessUrl({ exp, host }), NOW)).toEqual({
      ok: false,
      error: "wrong_host",
    });
  });

  it("rejects http, custom ports and embedded credentials", () => {
    const good = fakeAccessUrl({ exp });
    for (const bad of [
      good.replace("https://", "http://"),
      good.replace("playvalorant.com", "playvalorant.com:8443"),
      good.replace("https://", "https://user:pw@"),
    ]) {
      expect(parseAccessUrl(bad, NOW)).toEqual({ ok: false, error: "wrong_host" });
    }
  });

  it("rejects a URL with no token fragment", () => {
    expect(parseAccessUrl("https://playvalorant.com/opt_in", NOW)).toEqual({
      ok: false,
      error: "missing_tokens",
    });
    expect(parseAccessUrl("https://playvalorant.com/opt_in#id_token=a.b.c", NOW)).toEqual({
      ok: false,
      error: "missing_tokens",
    });
  });

  it("rejects tokens that aren't JWTs or have the wrong type", () => {
    expect(
      parseAccessUrl(
        "https://playvalorant.com/#access_token=abc&id_token=def&expires_in=3600",
        NOW,
      ),
    ).toEqual({ ok: false, error: "malformed_token" });
    const good = fakeAccessUrl({ exp });
    expect(parseAccessUrl(good.replace("token_type=Bearer", "token_type=Basic"), NOW)).toEqual({
      ok: false,
      error: "malformed_token",
    });
  });

  it("falls back to expires_in when the JWT has no exp", () => {
    const t = fakeJwt({ sub: "x" });
    const url = `https://playvalorant.com/#access_token=${t}&id_token=${t}&expires_in=1800`;
    const result = parseAccessUrl(url, NOW);
    expect(result.ok && result.tokens.expiresAt).toBe(NOW + 1_800_000);
  });

  it("rejects when no expiry can be determined", () => {
    const t = fakeJwt({ sub: "x" });
    expect(
      parseAccessUrl(`https://playvalorant.com/#access_token=${t}&id_token=${t}`, NOW),
    ).toEqual({ ok: false, error: "malformed_token" });
  });

  it("rejects an expired URL", () => {
    expect(parseAccessUrl(fakeAccessUrl({ exp: NOW / 1000 - 1 }), NOW)).toEqual({
      ok: false,
      error: "expired",
    });
  });
});

describe("jwt helpers", () => {
  it("decodes payloads and exp", () => {
    const token = fakeJwt({ exp: 123, sub: "ü" });
    expect(decodeJwtPayload(token)).toMatchObject({ exp: 123 });
    expect(jwtExpiry(token)).toBe(123_000);
  });

  it("returns null for garbage", () => {
    expect(decodeJwtPayload("nope")).toBeNull();
    expect(decodeJwtPayload("a.!!!.c")).toBeNull();
    expect(decodeJwtPayload("e30.bm90IGpzb24.x")).toBeNull();
    expect(decodeJwtPayload("e30.MTIz.x")).toBeNull();
    expect(jwtExpiry(fakeJwt({ exp: "soon" }))).toBeNull();
  });
});

describe("identityFromTokens", () => {
  const PUUID = "0D3E5A1B-7C2F-4E8A-9B6D-1F2A3C4D5E6F";

  it("reads the PUUID from sub and the Riot ID from the id_token", () => {
    const access = fakeJwt({ sub: PUUID });
    const id = fakeJwt({ sub: PUUID, acct: { game_name: "Ace", tag_line: "PH1" } });
    expect(identityFromTokens(access, id)).toEqual({
      puuid: PUUID.toLowerCase(),
      riotId: { gameName: "Ace", tagLine: "PH1" },
    });
  });

  it("falls back to the id_token sub and ignores non-UUID subjects", () => {
    expect(identityFromTokens(fakeJwt({ sub: "nope" }), fakeJwt({ sub: PUUID })).puuid).toBe(
      PUUID.toLowerCase(),
    );
    expect(identityFromTokens(fakeJwt({ sub: "nope" }), fakeJwt({}))).toEqual({
      puuid: null,
      riotId: null,
    });
  });

  it("needs both name parts for a Riot ID", () => {
    const id = fakeJwt({ sub: PUUID, acct: { game_name: "Ace", tag_line: "" } });
    expect(identityFromTokens("garbage", id).riotId).toBeNull();
    expect(identityFromTokens("garbage", fakeJwt({ acct: "x" })).riotId).toBeNull();
  });
});
