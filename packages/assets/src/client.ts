import { createStore, del, get, keys, set, type UseStore } from "idb-keyval";
import { z } from "zod";
import { reportDrift, sanitizeIssues } from "@valovertix/riot";
import {
  STATIC_RESOURCES,
  versionSchema,
  type GameVersion,
  type StaticData,
  type StaticKey,
} from "./schemas";

export const VALORANT_API_BASE = "https://valorant-api.com";
export const ASSET_DB_NAME = "valovertix-assets";

/** Bump when a schema changes so stale cache entries are refetched. */
const CACHE_FORMAT = 1;

let store: UseStore | null = null;
const getStore = () => (store ??= createStore(ASSET_DB_NAME, "static"));

export class StaticDataError extends Error {
  constructor(
    readonly resource: string,
    readonly reason: "network" | "http" | "schema",
  ) {
    super(`valorant-api.com ${resource}: ${reason}`);
    this.name = "StaticDataError";
  }
}

async function getJson<S extends z.ZodType>(
  resource: string,
  path: string,
  schema: S,
  f: typeof fetch,
  signal?: AbortSignal,
): Promise<z.output<S>> {
  let res: Response;
  try {
    res = await f(VALORANT_API_BASE + path, {
      signal: signal ?? null,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new StaticDataError(resource, "network");
  }
  if (!res.ok) throw new StaticDataError(resource, "http");
  const parsed = schema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) {
    reportDrift(sanitizeIssues(`static.${resource}`, parsed.error.issues));
    throw new StaticDataError(resource, "schema");
  }
  return parsed.data;
}

export const fetchGameVersion = (
  f: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<GameVersion> =>
  getJson("version", "/v1/version", z.object({ data: versionSchema }), f, signal).then(
    (r) => r.data,
  );

const cacheKey = (version: string, key: StaticKey) => `${CACHE_FORMAT}:${version}:${key}`;

/**
 * Returns a static resource for a game version, from IndexedDB when cached.
 * Older versions of the same resource are deleted after a fresh download.
 */
export async function loadStatic<K extends StaticKey>(
  key: K,
  version: string,
  opts: { fetch?: typeof fetch; signal?: AbortSignal } = {},
): Promise<StaticData<K>> {
  const k = cacheKey(version, key);
  const cached = await get<StaticData<K>>(k, getStore()).catch(() => undefined);
  if (cached) return cached;

  const resource = STATIC_RESOURCES[key];
  const body = await getJson(key, resource.path, resource.schema, opts.fetch ?? fetch, opts.signal);
  const data = body.data as StaticData<K>;

  try {
    await set(k, data, getStore());
    const stale = (await keys(getStore())).filter(
      (other) => typeof other === "string" && other.endsWith(`:${key}`) && other !== k,
    );
    await Promise.all(stale.map((s) => del(s, getStore())));
  } catch {
    // Private mode or quota exceeded: work without the cache.
  }
  return data;
}

/** Deletes the whole asset database (used by "Clear all data"). */
export async function deleteAssetCache(): Promise<void> {
  // idb-keyval keeps its connection open, which would block the delete.
  if (store) await store("readonly", (s) => s.transaction.db.close()).catch(() => {});
  store = null;
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(ASSET_DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}
