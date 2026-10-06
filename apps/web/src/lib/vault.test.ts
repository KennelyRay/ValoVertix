import {
  deleteVault,
  loadVault,
  rawVaultRecord,
  removeFromVault,
  saveToVault,
  vaultKey,
} from "./vault";

const NOW = 1_800_000_000_000;
const secret = "https://playvalorant.com/#access_token=very.secret.token";

describe("AES-GCM vault", () => {
  beforeEach(() => deleteVault());

  it("saves and loads an encrypted record", async () => {
    await saveToVault({ id: "a", expiresAt: NOW + 1000, accessUrl: secret });
    expect(await loadVault(NOW)).toEqual([{ id: "a", expiresAt: NOW + 1000, accessUrl: secret }]);
  });

  it("never stores the token in plain text", async () => {
    await saveToVault({ id: "a", expiresAt: NOW + 1000, accessUrl: secret });
    const raw = await rawVaultRecord("a");
    const bytes = new TextDecoder().decode(raw!.data);
    expect(bytes).not.toContain("very.secret.token");
    expect(raw!.iv).toHaveLength(12);
  });

  it("uses a non-extractable key", async () => {
    const key = await vaultKey();
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", key)).rejects.toThrow();
  });

  it("deletes expired records on load", async () => {
    await saveToVault({ id: "old", expiresAt: NOW - 1 });
    await saveToVault({ id: "new", expiresAt: NOW + 1 });
    expect((await loadVault<{ id: string }>(NOW)).map((r) => r.id)).toEqual(["new"]);
    expect(await rawVaultRecord("old")).toBeUndefined();
  });

  it("supports multiple accounts and forgetting one", async () => {
    await saveToVault({ id: "a", expiresAt: NOW + 1 });
    await saveToVault({ id: "b", expiresAt: NOW + 1 });
    await removeFromVault("a");
    expect((await loadVault<{ id: string }>(NOW)).map((r) => r.id)).toEqual(["b"]);
  });

  it("drops records that no longer decrypt (key was replaced)", async () => {
    await saveToVault({ id: "a", expiresAt: NOW + 1 });
    const record = await rawVaultRecord("a");
    await deleteVault();
    await saveToVault({ id: "b", expiresAt: NOW + 1 }); // creates a new key
    const { set, createStore } = await import("idb-keyval");
    const other = createStore("valovertix-vault", "vault");
    await set("acct:a", record, other);
    await other("readonly", (s) => s.transaction.db.close());
    expect((await loadVault<{ id: string }>(NOW)).map((r) => r.id)).toEqual(["b"]);
  });

  it("returns nothing from an empty vault", async () => {
    expect(await loadVault(NOW)).toEqual([]);
  });
});
