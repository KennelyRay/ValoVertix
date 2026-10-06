import { deleteAssetCache } from "@valovertix/assets";
import { useSessionStore } from "@/features/auth/session-store";
import { stopDemoWorker } from "./demo";
import { queryClient } from "./query-client";
import { deleteVault } from "./vault";

/**
 * Removes everything this app stored on the device: sessions, saved
 * accounts and their key, cached game data, settings and the demo worker.
 */
export async function clearAllData(): Promise<void> {
  await queryClient.cancelQueries();
  queryClient.clear();
  useSessionStore.getState().reset();
  stopDemoWorker();

  try {
    sessionStorage.clear();
    localStorage.clear();
  } catch {
    // Storage disabled: nothing stored there.
  }

  await Promise.all([deleteVault(), deleteAssetCache()]);

  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
    await Promise.all(regs.map((r) => r.unregister()));
  }
  if ("caches" in globalThis) {
    const names = await caches.keys().catch(() => []);
    await Promise.all(names.map((n) => caches.delete(n)));
  }
}
