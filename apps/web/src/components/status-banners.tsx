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

interface Failure {
  endpoint: string;
  kind: RiotErrorKind;
  status: number | undefined;
  count: number;
}

interface QueryHealth {
  rateLimited: number | null; // current retry attempt
  kinds: Set<RiotErrorKind>;
  failures: Failure[];
  /** Account data every player has came back 404: the likeliest cause is the wrong region. */
  coreNotFound: boolean;
}

/** Data every account has in its own region. A 404 here points at the wrong shard. */
const CORE_ENDPOINTS = new Set([
  "store.wallet",
  "store.owned.skinLevel",
  "player.loadout",
  "player.xp",
]);

const ENDPOINT_NAMES: Record<string, string> = {
  "store.owned.skinLevel": "Owned skins",
  "store.owned.skinChroma": "Skin variants",
  "store.owned.agent": "Agents",
  "store.owned.buddy": "Buddies",
  "store.owned.spray": "Sprays",
  "store.owned.playerCard": "Player cards",
  "store.owned.title": "Titles",
  "store.offers": "Store prices",
  "store.wallet": "Wallet",
  "player.loadout": "Equipped card and title",
  "player.xp": "Account level",
  "player.mmr": "Rank",
  "player.compUpdates": "Rank history",
  "player.matchHistory": "Match history",
  "match.details": "Match details",
  "player.names": "Riot ID",
};

const describeFailure = (f: Failure) =>
  `${ENDPOINT_NAMES[f.endpoint] ?? f.endpoint} (${f.status ?? f.kind}${f.count > 1 ? `, ${f.count} times` : ""})`;

/** Failure kinds that already have their own banner. */
const EXPLAINED: ReadonlySet<RiotErrorKind> = new Set([
  "auth",
  "rate_limit",
  "server",
  "forbidden",
  "schema",
]);

const EMPTY: QueryHealth = {
  rateLimited: null,
  kinds: new Set(),
  failures: [],
  coreNotFound: false,
};

/** Watches the active account's Riot queries for errors worth a banner. */
function useQueryHealth(sessionId: string | null): QueryHealth {
  const client = useQueryClient();
  const [health, setHealth] = useState<QueryHealth>(EMPTY);
  useEffect(() => {
    const cache = client.getQueryCache();
    const compute = () => {
      let rateLimited: number | null = null;
      const kinds = new Set<RiotErrorKind>();
      const failures = new Map<string, Failure>();
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
          if (!isRiotError(error)) continue;
          kinds.add(error.kind);
          const key = `${error.endpoint}|${error.status ?? error.kind}`;
          const prev = failures.get(key);
          failures.set(key, {
            endpoint: error.endpoint,
            kind: error.kind,
            status: error.status,
            count: (prev?.count ?? 0) + 1,
          });
        }
      }
      const list = [...failures.values()];
      const coreNotFound = list.some(
        (f) => f.kind === "not_found" && CORE_ENDPOINTS.has(f.endpoint),
      );
      const signature = (h: QueryHealth) =>
        `${h.rateLimited}|${[...h.kinds].join()}|${h.failures.map(describeFailure).join()}|${h.coreNotFound}`;
      const next: QueryHealth = { rateLimited, kinds, failures: list, coreNotFound };
      setHealth((prev) => (signature(prev) === signature(next) ? prev : next));
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

  if (session && health.coreNotFound) {
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

  const unexplained = health.failures.filter(
    (f) =>
      !EXPLAINED.has(f.kind) &&
      !(health.coreNotFound && CORE_ENDPOINTS.has(f.endpoint)) &&
      // A missing price list is explained where prices appear (tier-price note).
      f.endpoint !== "store.offers",
  );
  if (session && unexplained.length > 0) {
    banners.push(
      <Banner
        key="partial"
        tone="info"
        action={
          <Button
            size="sm"
            onClick={() =>
              void client.refetchQueries({
                queryKey: ["riot", session.id],
                predicate: (q) => q.state.status === "error",
              })
            }
          >
            Retry
          </Button>
        }
      >
        Some data didn't load from Riot: {unexplained.map(describeFailure).join(", ")}. Everything
        else on the page is up to date.
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
