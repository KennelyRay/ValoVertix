import { QueryCache, QueryClient } from "@tanstack/react-query";
import { isRiotError } from "@valovertix/riot";
import { useSessionStore } from "@/features/auth/session-store";

export const MAX_RATE_LIMIT_RETRIES = 3;

/** Exponential backoff with full jitter, honoring Retry-After when Riot sends it. */
export function retryDelay(attempt: number, error: unknown): number {
  const base = Math.min(1000 * 2 ** attempt, 15_000);
  const jittered = base / 2 + Math.random() * (base / 2);
  const retryAfter = isRiotError(error) ? error.retryAfterMs : undefined;
  return Math.max(jittered, retryAfter ?? 0);
}

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (!isRiotError(error)) return failureCount < 1;
  switch (error.kind) {
    case "rate_limit":
      return failureCount < MAX_RATE_LIMIT_RETRIES;
    case "network":
    case "server":
      return failureCount < 1;
    default:
      // Never retry auth failures: a stale token must not be replayed.
      return false;
  }
}

/** Query keys for Riot data start with ["riot", sessionId, ...]. */
export const riotKey = (sessionId: string, ...rest: unknown[]) =>
  ["riot", sessionId, ...rest] as const;

export function createQueryClient() {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Safe to log: the message is an endpoint label, error kind and status, never a URL or ID.
        if (isRiotError(error)) console.warn(`[ValoVertix] ${error.message}`);
        if (!isRiotError(error) || error.kind !== "auth") return;
        const [scope, sessionId] = query.queryKey;
        if (scope !== "riot" || typeof sessionId !== "string") return;
        // Stop everything for this account, then sign it out.
        void client.cancelQueries({ queryKey: ["riot", sessionId] });
        client.removeQueries({ queryKey: ["riot", sessionId] });
        void useSessionStore.getState().endSession(sessionId, "rejected");
      },
    }),
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        retryDelay,
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
      },
    },
  });
  return client;
}

export const queryClient = createQueryClient();
