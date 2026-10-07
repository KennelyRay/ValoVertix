/**
 * A shareable collection link, packed into the URL fragment (after "#"),
 * which browsers don't send to the server. It holds game item IDs only:
 * never tokens, PUUIDs or Riot IDs.
 *
 * Layout (version 1), base64url:
 *   u8   version
 *   u8   flags: 1 = has VP total, 2 = has name, 4 = paid skins only
 *   u16  day the link was made, days since 1970-01-01
 *   u32  VP total                       (if flag 1)
 *   u8   name length, then UTF-8 bytes  (if flag 2)
 *   u16  skin count, then 4 bytes per skin: the first 8 hex digits of its UUID
 */

const VERSION = 1;
const FLAG_VP = 1;
const FLAG_NAME = 2;
const FLAG_PAID = 4;
const DAY = 86_400_000;
export const SHARE_NAME_MAX = 24;
/** Keeps links comfortably short for chat apps (about 5,500 characters at most). */
export const SHARE_SKINS_MAX = 1000;

export interface SharedCollection {
  /** First 8 hex digits of each skin UUID, lowercase. */
  skinPrefixes: string[];
  name: string | null;
  vp: number | null;
  paidOnly: boolean;
  /** Midnight UTC of the day the link was made. */
  madeAt: number;
}

/** The 8-hex-digit key a skin is stored under in a link. */
export const skinPrefix = (uuid: string) => uuid.replace(/-/g, "").slice(0, 8).toLowerCase();

/** Trims, collapses spaces, drops control characters and caps the length. */
export function cleanShareName(name: string | null | undefined): string | null {
  const clean = (name ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SHARE_NAME_MAX);
  return clean || null;
}

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export function encodeShareLink(input: {
  skinIds: readonly string[];
  name?: string | null;
  vp?: number | null;
  paidOnly: boolean;
  at: number;
}): string {
  const name = cleanShareName(input.name);
  const nameBytes = name ? new TextEncoder().encode(name) : null;
  const hasVp = input.vp != null && input.vp >= 0;
  const prefixes = [...new Set(input.skinIds.map(skinPrefix))]
    .filter((p) => /^[0-9a-f]{8}$/.test(p))
    .slice(0, SHARE_SKINS_MAX);

  const size =
    1 + 1 + 2 + (hasVp ? 4 : 0) + (nameBytes ? 1 + nameBytes.length : 0) + 2 + prefixes.length * 4;
  const buf = new DataView(new ArrayBuffer(size));
  let o = 0;
  buf.setUint8(o++, VERSION);
  buf.setUint8(
    o++,
    (hasVp ? FLAG_VP : 0) | (nameBytes ? FLAG_NAME : 0) | (input.paidOnly ? FLAG_PAID : 0),
  );
  buf.setUint16(o, Math.floor(input.at / DAY));
  o += 2;
  if (hasVp) {
    buf.setUint32(o, Math.min(Math.round(input.vp!), 0xffffffff));
    o += 4;
  }
  if (nameBytes) {
    buf.setUint8(o++, nameBytes.length);
    nameBytes.forEach((b) => buf.setUint8(o++, b));
  }
  buf.setUint16(o, prefixes.length);
  o += 2;
  for (const p of prefixes) {
    buf.setUint32(o, parseInt(p, 16));
    o += 4;
  }
  return toBase64Url(new Uint8Array(buf.buffer));
}

/** Reads a link fragment; null for anything malformed, truncated or from a newer version. */
export function decodeShareLink(fragment: string): SharedCollection | null {
  const bytes = fromBase64Url(fragment.replace(/^#/, ""));
  if (!bytes || bytes.length < 6) return null;
  const view = new DataView(bytes.buffer);
  let o = 0;
  const need = (n: number) => o + n <= bytes.length;

  if (view.getUint8(o++) !== VERSION) return null;
  const flags = view.getUint8(o++);
  const madeAt = view.getUint16(o) * DAY;
  o += 2;

  let vp: number | null = null;
  if (flags & FLAG_VP) {
    if (!need(4)) return null;
    vp = view.getUint32(o);
    o += 4;
  }
  let name: string | null = null;
  if (flags & FLAG_NAME) {
    if (!need(1)) return null;
    const len = view.getUint8(o++);
    if (!need(len)) return null;
    try {
      name = cleanShareName(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(o, o + len)),
      );
    } catch {
      return null;
    }
    o += len;
  }
  if (!need(2)) return null;
  const count = view.getUint16(o);
  o += 2;
  if (count > SHARE_SKINS_MAX || !need(count * 4)) return null;
  const skinPrefixes: string[] = [];
  for (let i = 0; i < count; i++) {
    skinPrefixes.push(view.getUint32(o).toString(16).padStart(8, "0"));
    o += 4;
  }
  return { skinPrefixes, name, vp, paidOnly: Boolean(flags & FLAG_PAID), madeAt };
}
