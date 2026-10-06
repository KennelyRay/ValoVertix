import { create } from "zustand";
import type { Shard } from "@valovertix/riot";
import { loadVault, removeFromVault, saveToVault } from "@/lib/vault";

export interface RiotId {
  gameName: string;
  tagLine: string;
}

export interface Session {
  /** Random local ID. Never the PUUID, so it is safe in query keys and DOM. */
  id: string;
  accessToken: string;
  idToken: string;
  entitlementsToken: string;
  expiresAt: number;
  puuid: string;
  shard: Shard;
  /** True when the region was picked by hand because riot-geo failed. */
  shardPicked: boolean;
  clientVersion: string;
  riotId: RiotId | null;
  remembered: boolean;
  demo: boolean;
}

export type SignedOutReason = "expired" | "rejected" | null;

interface SessionState {
  sessions: Session[];
  activeId: string | null;
  hydrated: boolean;
  /** True while boot is still restoring sessions or starting the demo. */
  booting: boolean;
  setBooting: (v: boolean) => void;
  signedOutReason: SignedOutReason;
  hydrate: () => Promise<void>;
  addSession: (session: Session) => Promise<void>;
  setActive: (id: string) => void;
  setShard: (id: string, shard: Shard) => void;
  forget: (id: string) => Promise<void>;
  /** Ends a session whose token expired or was rejected. Never retries. */
  endSession: (id: string, reason: Exclude<SignedOutReason, null>) => Promise<void>;
  dismissSignedOut: () => void;
  reset: () => void;
}

const STORAGE_KEY = "vv.sessions";

function readSessionStorage(): { sessions: Session[]; activeId: string | null } {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { sessions: [], activeId: null };
    const parsed = JSON.parse(raw) as { sessions: Session[]; activeId: string | null };
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      activeId: parsed.activeId,
    };
  } catch {
    return { sessions: [], activeId: null };
  }
}

function writeSessionStorage(sessions: Session[], activeId: string | null) {
  try {
    if (sessions.length === 0) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions, activeId }));
  } catch {
    // Storage disabled: the session lives in memory only.
  }
}

const persistRemembered = (s: Session) =>
  s.remembered && !s.demo ? saveToVault(s) : removeFromVault(s.id);

export const useSessionStore = create<SessionState>()((set, get) => {
  const commit = (sessions: Session[], activeId: string | null) => {
    const active = sessions.some((s) => s.id === activeId) ? activeId : (sessions[0]?.id ?? null);
    set({ sessions, activeId: active });
    writeSessionStorage(sessions, active);
  };

  return {
    sessions: [],
    activeId: null,
    hydrated: false,
    booting: true,
    setBooting: (booting) => set({ booting }),
    signedOutReason: null,

    hydrate: async () => {
      const now = Date.now();
      const fromTab = readSessionStorage();
      let remembered: Session[] = [];
      try {
        remembered = await loadVault<Session>(now);
      } catch {
        // IndexedDB unavailable (private mode): only this tab's sessions.
      }
      const byId = new Map<string, Session>();
      for (const s of [...remembered, ...fromTab.sessions])
        if (s.expiresAt > now) byId.set(s.id, s);
      commit([...byId.values()], fromTab.activeId);
      set({ hydrated: true });
    },

    addSession: async (session) => {
      const existing = get().sessions.find((s) => s.puuid === session.puuid);
      const next = { ...session, id: existing?.id ?? session.id };
      commit([...get().sessions.filter((s) => s.id !== next.id), next], next.id);
      set({ signedOutReason: null });
      await persistRemembered(next).catch(() => {});
    },

    setActive: (id) => commit(get().sessions, id),

    setShard: (id, shard) => {
      const sessions = get().sessions.map((s) =>
        s.id === id ? { ...s, shard, shardPicked: true } : s,
      );
      commit(sessions, get().activeId);
      const updated = sessions.find((s) => s.id === id);
      if (updated) void persistRemembered(updated).catch(() => {});
    },

    forget: async (id) => {
      commit(
        get().sessions.filter((s) => s.id !== id),
        get().activeId === id ? null : get().activeId,
      );
      await removeFromVault(id).catch(() => {});
    },

    endSession: async (id, reason) => {
      const session = get().sessions.find((s) => s.id === id);
      if (!session) return;
      const wasActive = get().activeId === id;
      commit(
        get().sessions.filter((s) => s.id !== id),
        wasActive ? null : get().activeId,
      );
      if (wasActive) set({ signedOutReason: reason });
      await removeFromVault(id).catch(() => {});
    },

    dismissSignedOut: () => set({ signedOutReason: null }),

    reset: () => {
      writeSessionStorage([], null);
      set({ sessions: [], activeId: null, signedOutReason: null });
    },
  };
});

export const useActiveSession = () =>
  useSessionStore((s) => s.sessions.find((x) => x.id === s.activeId) ?? null);
