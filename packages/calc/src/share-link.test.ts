import { describe, expect, it } from "vitest";
import {
  SHARE_SKINS_MAX,
  cleanShareName,
  decodeShareLink,
  encodeShareLink,
  skinPrefix,
} from "./share-link";

const A = "9C82E19D-4575-0200-1A81-3EACF00CF872";
const B = "0000beef-0000-0000-0000-000000000000";
const DAY = 86_400_000;

describe("share links", () => {
  it("round-trips skins, name, value and flags", () => {
    const link = encodeShareLink({
      skinIds: [A, B, A.toLowerCase(), "not-a-uuid"],
      name: "  Ace\n  of  Spades ",
      vp: 123456.4,
      paidOnly: true,
      at: 20_000 * DAY + 5_000,
    });
    expect(link).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeShareLink(`#${link}`)).toEqual({
      skinPrefixes: ["9c82e19d", "0000beef"],
      name: "Ace of Spades",
      vp: 123456,
      paidOnly: true,
      madeAt: 20_000 * DAY,
    });
  });

  it("leaves out an empty name and a missing value", () => {
    const link = encodeShareLink({ skinIds: [B], name: "   ", vp: null, paidOnly: false, at: 0 });
    expect(decodeShareLink(link)).toEqual({
      skinPrefixes: ["0000beef"],
      name: null,
      vp: null,
      paidOnly: false,
      madeAt: 0,
    });
    expect(
      decodeShareLink(encodeShareLink({ skinIds: [], paidOnly: false, at: 0, vp: -1 }))?.vp,
    ).toBeNull();
  });

  it("caps the value, the name and the skin count", () => {
    const many = Array.from({ length: SHARE_SKINS_MAX + 5 }, (_, i) =>
      i.toString(16).padStart(8, "0"),
    );
    const decoded = decodeShareLink(
      encodeShareLink({ skinIds: many, name: "x".repeat(40), vp: 1e12, paidOnly: false, at: 0 }),
    )!;
    expect(decoded.skinPrefixes).toHaveLength(SHARE_SKINS_MAX);
    expect(decoded.name).toHaveLength(24);
    expect(decoded.vp).toBe(0xffffffff);
  });

  it("rejects malformed, truncated and future-version links", () => {
    const good = encodeShareLink({ skinIds: [A, B], name: "Me", vp: 5, paidOnly: true, at: 0 });
    const bytes = Uint8Array.from(atob(good.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
      c.charCodeAt(0),
    );
    const enc = (b: Uint8Array) =>
      btoa(String.fromCharCode(...b))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

    expect(decodeShareLink("")).toBeNull();
    expect(decodeShareLink("not base64!")).toBeNull();
    expect(decodeShareLink("A")).toBeNull(); // invalid base64 length
    expect(decodeShareLink(enc(Uint8Array.of(2, 0, 0, 0, 0, 0)))).toBeNull();
    // Cut at every point: each truncation is rejected, never misread.
    for (let n = 4; n < bytes.length; n++)
      expect(decodeShareLink(enc(bytes.subarray(0, n)))).toBeNull();
    // Flags promise a value / a name that isn't there.
    expect(decodeShareLink(enc(Uint8Array.of(1, 1, 0, 0, 0, 0)))).toBeNull();
    expect(decodeShareLink(enc(Uint8Array.of(1, 2, 0, 0, 0, 0)))).toBeNull();
    expect(decodeShareLink(enc(Uint8Array.of(1, 2, 0, 0, 5, 0)))).toBeNull();
    // A name that isn't valid UTF-8.
    expect(decodeShareLink(enc(Uint8Array.of(1, 2, 0, 0, 1, 0xff, 0, 0)))).toBeNull();
    // A skin count above the cap.
    expect(decodeShareLink(enc(Uint8Array.of(1, 0, 0, 0, 0xff, 0xff)))).toBeNull();
  });

  it("cleans names and makes prefixes", () => {
    expect(cleanShareName(null)).toBeNull();
    expect(cleanShareName("a\u0007b")).toBe("ab");
    expect(skinPrefix(A)).toBe("9c82e19d");
  });
});
