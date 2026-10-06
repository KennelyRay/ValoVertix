import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  SHARDS,
  SHARD_LABELS,
  isRiotError,
  onSchemaDrift,
  type RiotErrorKind,
  type Shard,
} from "@valovertix/riot";
import { MAX_RATE_LIMIT_RETRIES } from "@/lib/query-client";
import { useActiveSession, useSessionStore } from "@/features/auth/session-store";
import { SignInPanel } from "@/features/auth/sign-in-panel";
import { cn } from "@/lib/cn";
import { Button } from "./ui/button";
import { Dialog } from "./ui/primitives";

interface QueryHealth {
  rateLimited: number | null; // current retry attempt
  kinds: Set<RiotErrorKind>;
}

/** Watches the active account's Riot queries for errors worth a banner. */
function useQueryHealth(sessionId: string | null): QueryHealth {
  const client = useQueryClient();
  const [health, setHealth] = useState<QueryHealth>({ rateLimited: null, kinds: new Set() });
  useEffect(() => {
    const cache = client.getQueryCache();
    const compute = () => {
      let rateLimited: number | null = null;
      const kinds = new Set<RiotErrorKind>();
      if (sessionId) {
        for (const q of cache.findAll({ queryKey: ["riot", sessionId] })) {
          const { fetchStatus, fetchFailureReason, fetchFailureCount, error } = q.state;
          if (
            fetchStatus === "fetching" &&
            isRiotError(fetchFailureReason) &&
            fetchFailureReason.kind === "rate_limit"
          ) {
            rateLimited = Math.max(rateLimited ?? 0, fetchFailureCount);
          }
          if (isRiotError(error)) kinds.add(error.kind);
        }
      }
      setHealth((prev) =>
        prev.rateLimited === rateLimited && [...kinds].join() === [...prev.kinds].join()
          ? prev
          : { rateLimited, kinds },
      );
    };
    compute();
    // The cache notifies while other components render (a query is created
    // inside useQuery), so update after the current render, once per tick.
    let scheduled = false;
    let active = true;
    const unsubscribe = cache.subscribe(() => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        if (active) compute();
      });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [client, sessionId]);
  return health;
}

function Banner({
  tone,
  children,
  action,
}: {
  tone: "warn" | "error" | "info";
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border px-4 py-2 text-sm",
        tone === "error" && "border-loss/50 bg-loss/10",
        tone === "warn" && "border-warn/40 bg-warn/10",
        tone === "info" && "border-line-strong bg-raised",
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

function RegionFix({ sessionId, current }: { sessionId: string; current: Shard }) {
  const setShard = useSessionStore((s) => s.setShard);
  const client = useQueryClient();
  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">Switch region</span>
      <select
        value={current}
        onChange={(e) => {
          setShard(sessionId, e.target.value as Shard);
          void client.invalidateQueries({ queryKey: ["riot", sessionId] });
        }}
        className="min-h-11 border border-line-strong bg-raised px-2"
      >
        {SHARDS.map((s) => (
          <option key={s} value={s}>
            {SHARD_LABELS[s]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function StatusBanners() {
  const session = useActiveSession();
  const signedOutReason = useSessionStore((s) => s.signedOutReason);
  const dismiss = useSessionStore((s) => s.dismissSignedOut);
  const health = useQueryHealth(session?.id ?? null);
  const client = useQueryClient();
  const [drift, setDrift] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  useEffect(() => onSchemaDrift(() => setDrift(true)), []);

  const banners: ReactNode[] = [];

  if (signedOutReason) {
    banners.push(
      <Banner
        key="signed-out"
        tone="warn"
        action={
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={() => setSignInOpen(true)}>
              Sign in again
            </Button>
            <Button variant="ghost" size="sm" onClick={dismiss}>
              Dismiss
            </Button>
          </div>
        }
      >
        {signedOutReason === "expired"
          ? "Your Riot sign-in expired, so we stopped loading data and removed it from this device."
          : "Riot stopped accepting this sign-in, so we stopped loading data and removed it from this device."}
      </Banner>,
    );
  }

  if (health.rateLimited !== null) {
    banners.push(
      <Banner key="429" tone="info">
        Riot is limiting requests. Retrying ({Math.min(health.rateLimited, MAX_RATE_LIMIT_RETRIES)}{" "}
        of {MAX_RATE_LIMIT_RETRIES})…
      </Banner>,
    );
  } else if (health.kinds.has("rate_limit")) {
    banners.push(
      <Banner
        key="429-final"
        tone="warn"
        action={
          <Button
            size="sm"
            onClick={() =>
              void client.refetchQueries({ queryKey: ["riot", session?.id], type: "active" })
            }
          >
            Try again
          </Button>
        }
      >
        Riot is still limiting requests. Wait a minute, then try again.
      </Banner>,
    );
  }

  if (health.kinds.has("server")) {
    banners.push(
      <Banner key="5xx" tone="warn">
        Riot's servers are having trouble or are down for maintenance. Some numbers may be missing
        until they recover.
      </Banner>,
    );
  }

  if (health.kinds.has("forbidden")) {
    banners.push(
      <Banner key="403" tone="error">
        Riot rejected this request. This sometimes happens for a while after many requests. Try
        again later.
      </Banner>,
    );
  }

  if (session && health.kinds.has("not_found")) {
    banners.push(
      <Banner
        key="404"
        tone="warn"
        action={<RegionFix sessionId={session.id} current={session.shard} />}
      >
        Riot couldn't find this account's data in {SHARD_LABELS[session.shard]}. If you play in
        another region, switch it here.
      </Banner>,
    );
  }

  if (drift) {
    banners.push(
      <Banner
        key="drift"
        tone="info"
        action={
          <Button variant="ghost" size="sm" onClick={() => setDrift(false)}>
            Dismiss
          </Button>
        }
      >
        Some data couldn't be read. Riot may have changed something. What we could read is shown.
      </Banner>,
    );
  }

  return (
    <>
      {banners.length > 0 && <div className="mx-auto mb-4 max-w-7xl space-y-2 px-4">{banners}</div>}
      <Dialog open={signInOpen} onClose={() => setSignInOpen(false)} title="Sign in again">
        <SignInPanel compact onDone={() => setSignInOpen(false)} />
      </Dialog>
    </>
  );
}
