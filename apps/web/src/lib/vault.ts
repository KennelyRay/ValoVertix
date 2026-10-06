import { createStore, del, entries, get, set, type UseStore } from "idb-keyval";

/**
 * "Remember this account" storage.
 *
 * Sessions are encrypted with AES-GCM using a non-extractable CryptoKey that
 * lives in IndexedDB. Scripts can use the key but never read its bytes, which
 * stops casual inspection of the stored data. It does NOT protect against
 * malware or anyone else using the same browser profile: they can run the
 * key too.
 */

export const VAULT_DB_NAME = "valovertix-vault";
const KEY_ID = "key:aes-gcm";
const RECORD_PREFIX = "acct:";

interface VaultRecord {
  id: string;
  expiresAt: number;
  iv: Uint8Array<ArrayBuffer>;
  data: ArrayBuffer;
}

let store: UseStore | null = null;
const getStore = () => (store ??= createStore(VAULT_DB_NAME, "vault"));

async function getKey(): Promise<CryptoKey> {
  const existing = await get<CryptoKey>(KEY_ID, getStore());
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
  await set(KEY_ID, key, getStore());
  return key;
}

export async function saveToVault<T extends { id: string; expiresAt: number }>(value: T) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(value)),
  );
  const record: VaultRecord = { id: value.id, expiresAt: value.expiresAt, iv, data };
  await set(RECORD_PREFIX + value.id, record, getStore());
}

/** Decrypts all unexpired records. Expired or unreadable records are deleted. */
export async function loadVault<T>(now = Date.now()): Promise<T[]> {
  const all = await entries<string, VaultRecord>(getStore());
  const records = all.filter(([k]) => String(k).startsWith(RECORD_PREFIX));
  if (records.length === 0) return [];
  const key = await getKey();
  const out: T[] = [];
  for (const [k, record] of records) {
    if (record.expiresAt <= now) {
      await del(k, getStore());
      continue;
    }
    try {
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: record.iv },
        key,
        record.data,
      );
      out.push(JSON.parse(new TextDecoder().decode(plain)) as T);
    } catch {
      await del(k, getStore());
    }
  }
  return out;
}

export const removeFromVault = (id: string) => del(RECORD_PREFIX + id, getStore());

/** Deletes the vault database, including the key. */
export async function deleteVault(): Promise<void> {
  if (store) await store("readonly", (s) => s.transaction.db.close()).catch(() => {});
  store = null;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(VAULT_DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

/** For tests: the raw stored record, to prove nothing is in plain text. */
export const rawVaultRecord = (id: string) => get<VaultRecord>(RECORD_PREFIX + id, getStore());
export const vaultKey = () => getKey();
