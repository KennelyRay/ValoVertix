import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useSessionStore, type SignedOutReason } from "@/features/auth/session-store";
import { SignInPanel } from "@/features/auth/sign-in-panel";
import { cn } from "@/lib/cn";
import { DemoButton } from "./shared";

/** What each app page shows once connected, for the "not connected yet" state. */
const PAGE_INFO: Record<string, { blurb: string; points: string[] }> = {
  Dashboard: {
    blurb: "Your player card, wallet, rank and an estimate of what your collection is worth.",
    points: [
      "Equipped player card and level",
      "VP, Radianite and Kingdom Credits",
      "Collection value estimate",
    ],
  },
  Store: {
    blurb: "Your shop right now, with a money estimate next to every VP price.",
    points: ["Daily offers and reset timer", "Featured bundles", "Night Market, when it's on"],
  },
  Spending: {
    blurb: "What your skins would cost at today's store prices.",
    points: [
      "Total in VP and your currency",
      "Breakdown by tier, weapon and collection",
      "Your most expensive skins",
    ],
  },
  Stats: {
    blurb: "Rank, act rank and your recent matches, straight from Riot.",
    points: [
      "Current, peak and act rank",
      "Full match scoreboards",
      "Headshot %, ADR and weapon kills",
    ],
  },
  Collection: {
    blurb: "Everything on the account: skins, bundles, your loadout and a wishlist.",
    points: [
      "Skins with levels and variants",
      "Bundle progress and cost to complete",
      "Equipped loadout",
    ],
  },
  "Share card": {
    blurb: "PNG cards of your locker, spending, profile, rank or loadout.",
    points: ["Five templates", "Square, story and link sizes", "Riot ID off by default"],
  },
};

const COPY: Record<
  Exclude<SignedOutReason, null>,
  { eyebrow: string; headline: string; body: string }
> = {
  expired: {
    eyebrow: "Session expired",
    headline: "Timed out",
    body: "Riot sign-ins last about an hour. Yours ran out, so we stopped loading data and deleted it from this device.",
  },
  rejected: {
    eyebrow: "Signed out",
    headline: "Sign-in ended",
    body: "Riot stopped accepting this sign-in, so we stopped loading data and deleted it from this device.",
  },
};

/** A drained countdown ring, like a round timer at zero. Decorative. */
function DrainedTimer() {
  const r = 52;
  return (
    <div aria-hidden className="relative size-32 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-line)" strokeWidth="6" />
        {/* A sliver of red where the time ran out. */}
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="6"
          strokeDasharray={`6 ${2 * Math.PI * r}`}
        />
        {Array.from({ length: 12 }, (_, i) => (
          <line
            key={i}
            x1="60"
            y1="2"
            x2="60"
            y2={i % 3 === 0 ? 10 : 6}
            stroke="var(--color-line-strong)"
            strokeWidth="2"
            transform={`rotate(${i * 30} 60 60)`}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold tabular-nums leading-none">00:00</span>
        <span className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-muted">
          Left
        </span>
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
      <span aria-hidden className="h-0.5 w-8 bg-accent" />
      {children}
    </p>
  );
}

/** The app-page view without a connected account: after expiry, rejection, or before first sign-in. */
export function SignedOut({ title }: { title: string }) {
  const reason = useSessionStore((s) => s.signedOutReason);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const info = PAGE_INFO[title];
  const copy = reason ? COPY[reason] : null;

  return (
    <div className="relative isolate flex min-h-[calc(100dvh-13rem)] flex-col justify-center overflow-hidden py-6 pb-28 sm:pb-40">
      {/* Oversized outline word behind the content, like the game site's section art. */}
      <p
        aria-hidden
        className="numeral-outline pointer-events-none absolute -bottom-6 left-0 -z-10 select-none whitespace-nowrap text-[7rem] uppercase opacity-60 sm:text-[12rem] lg:text-[15rem]"
      >
        {copy ? "Offline" : title}
      </p>

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_28rem]">
        <div className="min-w-0">
          <Eyebrow>{copy ? copy.eyebrow : "Not connected"}</Eyebrow>
          <div className={cn("mt-4 flex flex-wrap items-center gap-6", !copy && "block")}>
            {reason === "expired" && <DrainedTimer />}
            <div className="min-w-0">
              <h1 className="display-xl text-6xl sm:text-7xl">{copy ? copy.headline : title}</h1>
              {copy && (
                <p className="mt-2 font-display text-lg font-semibold uppercase tracking-wider text-muted">
                  {title} needs a fresh sign-in
                </p>
              )}
            </div>
          </div>

          <p className="mt-5 max-w-xl text-lg text-muted">
            {copy ? copy.body : (info?.blurb ?? "Connect a Riot account to see this page.")}
          </p>

          {copy ? (
            <dl className="mt-8 grid max-w-xl gap-px border border-line bg-line sm:grid-cols-2">
              <div className="bg-surface p-4">
                <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  Still on this device
                </dt>
                <dd className="mt-1 text-sm">
                  Your settings and wishlist. They never held account data.
                </dd>
              </div>
              <div className="bg-surface p-4">
                <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  Gone from this device
                </dt>
                <dd className="mt-1 text-sm">The expired token and the data loaded with it.</dd>
              </div>
            </dl>
          ) : (
            info && (
              <ul className="mt-8 grid max-w-xl gap-px border border-line bg-line sm:grid-cols-3">
                {info.points.map((p, i) => (
                  <li key={p} className="bg-surface p-4">
                    <span aria-hidden className="numeral-outline block text-4xl">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="mt-2 block text-sm">{p}</span>
                  </li>
                ))}
              </ul>
            )
          )}

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <DemoButton label={copy ? "Use the demo meanwhile" : "Try the demo account"} />
            <p className="text-sm text-muted">
              No sign-in needed. Made-up data, nothing from Riot.
            </p>
          </div>
        </div>

        <section
          aria-labelledby="reconnect-title"
          className="panel panel-raised relative p-5 sm:p-6"
        >
          <span
            aria-hidden
            className="absolute -left-px -top-px h-6 w-6 border-l-2 border-t-2 border-accent"
          />
          <span
            aria-hidden
            className="absolute -bottom-px -right-px h-6 w-6 border-b-2 border-r-2 border-accent"
          />
          <h2 id="reconnect-title" className="display-xl text-3xl">
            {copy ? "Reconnect" : "Connect"}
          </h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            {copy ? `You'll land back on ${title}.` : "Two steps, about a minute."}
          </p>
          <SignInPanel compact redirectTo={path} />
        </section>
      </div>
    </div>
  );
}
