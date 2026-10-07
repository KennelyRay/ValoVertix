import { useCallback, useSyncExternalStore } from "react";
import { useIsFetching, useQueryClient, type Query } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useActiveSession } from "@/features/auth/session-store";
import { useNow } from "@/features/auth/account-bar";
import { cn } from "@/lib/cn";
import { fmtAgo } from "@/lib/format";

/** Riot queries worth refreshing: this account's, minus match details, which never change. */
const isLive = (sessionId: string | undefined) => (q: Query) =>
  q.queryKey[0] === "riot" && q.queryKey[1] === sessionId && q.queryKey[3] !== "match";

/** When this page's account data was loaded, and a way to load it again. */
export function useDataFreshness() {
  const client = useQueryClient();
  const session = useActiveSession();
  const id = session?.id;
  const fetching = useIsFetching({ predicate: isLive(id) }) > 0;
  const cache = client.getQueryCache();
  // An external store read: the cache can change while other components render,
  // which useSyncExternalStore handles (a plain subscription + setState would not).
  const subscribe = useCallback((onChange: () => void) => cache.subscribe(onChange), [cache]);
  const oldest = useSyncExternalStore(
    subscribe,
    () => {
      if (!id) return null;
      // The oldest data on screen is what "updated" honestly means.
      const times = cache
        .findAll({ predicate: isLive(id) })
        .filter((q) => q.getObserversCount() > 0 && q.state.dataUpdatedAt > 0)
        .map((q) => q.state.dataUpdatedAt);
      return times.length ? Math.min(...times) : null;
    },
    () => null,
  );

  const refresh = useCallback(
    () => client.refetchQueries({ predicate: isLive(id), type: "active" }),
    [client, id],
  );
  return { session, oldest, fetching, refresh };
}

export function DataFreshness({ className }: { className?: string }) {
  const { session, oldest, fetching, refresh } = useDataFreshness();
  const now = useNow(15_000);
  if (!session) return null;
  return (
    <div className={cn("flex items-center gap-2 text-sm text-muted", className)}>
      <span aria-live="polite">
        {fetching ? "Updating…" : oldest ? `Updated ${fmtAgo(now - oldest)}` : null}
      </span>
      <button
        type="button"
        onClick={() => void refresh()}
        disabled={fetching}
        title="Refresh (R)"
        className="tap inline-flex min-h-10 items-center gap-1.5 border border-line-strong px-3 font-semibold text-text transition-colors hover:border-text disabled:opacity-60 sm:min-h-11"
      >
        {/* Arrows icon: it reloads. Spins only while loading. */}
        <RefreshCw aria-hidden className={cn("size-4", fetching && "animate-spin")} />
        Refresh
      </button>
    </div>
  );
}
