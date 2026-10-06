import { Link } from "@tanstack/react-router";
import { DemoButton } from "@/components/shared";
import { buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/ui/primitives";
import { OFFICIAL_DOMAIN } from "@/config/app";
import { useActiveSession } from "@/features/auth/session-store";
import { SignInPanel } from "@/features/auth/sign-in-panel";
import { cn } from "@/lib/cn";

const STORED = [
  ["Your access token", "In this tab's memory and session storage. Gone when you close the tab."],
  [
    "Remembered accounts (only if you tick the box)",
    "Encrypted in this browser until the token expires, about an hour.",
  ],
  [
    "Game data like skin names and images",
    "Cached in this browser so pages load faster next time.",
  ],
] as const;

const NOT_STORED = [
  "Your Riot password. You only ever type it on Riot's site.",
  "Anything on a server of ours. Riot data goes straight from Riot to your browser.",
  "Cookies or tracking identifiers.",
] as const;

export default function Landing() {
  const session = useActiveSession();
  return (
    <div className="space-y-20 py-6 sm:py-10">
      <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_30rem]">
        <div className="pt-2">
          <h1 className="max-w-xl text-5xl leading-[1.02] sm:text-7xl">
            See what your arsenal is really worth
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted">
            Every skin you own, an estimate of what it cost in VP and pesos, and your rank history
            and recent matches. Built for players in the Philippines.
          </p>
          <p className="mt-4 max-w-lg">
            Your Riot password is never entered here. You sign in on Riot's official page, and your
            access token stays in your browser.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {session ? (
              <Link to="/dashboard" className={cn(buttonVariants({ variant: "primary" }))}>
                Open your dashboard
              </Link>
            ) : (
              <DemoButton label="Look around with a demo account" />
            )}
            <Link to="/guide" className={cn(buttonVariants({ variant: "ghost" }))}>
              How signing in works
            </Link>
          </div>
        </div>

        <Panel aria-labelledby="connect-title" className="panel-raised">
          <h2 id="connect-title" className="mb-4 text-2xl">
            Connect your account
          </h2>
          <SignInPanel />
        </Panel>
      </section>

      <section
        aria-labelledby="sign-in-title"
        className="grid gap-10 lg:grid-cols-[18rem_minmax(0,1fr)]"
      >
        <div>
          <h2 id="sign-in-title" className="text-3xl">
            What happens when you connect
          </h2>
          <p className="mt-2 text-muted">
            ValoVertix has no accounts and no backend. Here is exactly what it does with your
            sign-in.
          </p>
        </div>
        <div className="space-y-8">
          <p className="max-w-2xl leading-relaxed">
            Riot's sign-in page sends you to a playvalorant.com address that contains a short-lived
            access token. You paste that address here. This page reads the token in your browser and
            uses it to ask Riot's servers for your inventory, prices and match history. Those
            requests go from your browser directly to Riot. When the token expires, about an hour
            later, the page stops and asks you to sign in again.
          </p>
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-xl">Stored on this device</h3>
              <dl className="mt-3 space-y-3">
                {STORED.map(([what, how]) => (
                  <div key={what}>
                    <dt className="font-medium">{what}</dt>
                    <dd className="text-sm text-muted">{how}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h3 className="text-xl">Never stored or sent</h3>
              <ul className="mt-3 list-disc space-y-3 pl-5 marker:text-muted">
                {NOT_STORED.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-l-2 border-warn pl-4 text-sm">
            <p className="font-medium">Treat that address like a password for the next hour.</p>
            <p className="mt-1 text-muted">
              Anyone who has it can access your account until it expires. Only paste it into apps
              you trust, and check that you are on{" "}
              <span className="font-medium text-text">{OFFICIAL_DOMAIN}</span>.
            </p>
          </div>
          <p className="text-sm">
            <Link to="/privacy" className="underline underline-offset-4 hover:text-accent">
              Read the full privacy details
            </Link>
            , including every Riot address the app talks to.
          </p>
        </div>
      </section>

      <section aria-labelledby="what-title">
        <h2 id="what-title" className="text-3xl">
          What you'll see
        </h2>
        <dl className="mt-6 grid gap-x-10 gap-y-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <dt className="font-display text-2xl font-semibold">Spending estimate</dt>
            <dd className="mt-1 max-w-xl text-muted">
              Your skins priced at today's store offers, converted to pesos using PH VP pack prices.
              It is an estimate: bundles, Night Market discounts and gifts aren't visible to us, so
              the page shows a range and lists what it can't count.
            </dd>
          </div>
          <div>
            <dt className="font-display text-2xl font-semibold">Rank and matches</dt>
            <dd className="mt-1 text-muted">
              Current and peak rank, RR history, win rate and agent picks.
            </dd>
          </div>
          <div>
            <dt className="font-display text-xl font-semibold">Collection</dt>
            <dd className="mt-1 text-muted">
              Skins by weapon with levels and chromas, plus buddies, cards, sprays and titles.
            </dd>
          </div>
          <div>
            <dt className="font-display text-xl font-semibold">Wallet</dt>
            <dd className="mt-1 text-muted">VP, Radianite and Kingdom Credits.</dd>
          </div>
          <div>
            <dt className="font-display text-xl font-semibold">Share card</dt>
            <dd className="mt-1 text-muted">
              A PNG of your collection or rank. Your Riot ID is only on it if you choose.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
