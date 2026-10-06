import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { m, useScroll, useTransform } from "framer-motion";
import { DemoButton } from "@/components/shared";
import { Panel } from "@/components/ui/primitives";
import { OFFICIAL_DOMAIN } from "@/config/app";
import { useActiveSession } from "@/features/auth/session-store";
import { SignInPanel } from "@/features/auth/sign-in-panel";
import { useStatic } from "@/features/data";
import { SkinShowcase } from "@/features/landing/skin-showcase";

/*
 * Design read: a game-companion landing page for PH VALORANT players, in the
 * game's own web/launcher language (owner request). Dials ENERGY 3 / RHYTHM 3
 * / MOTION 2: a loud hero, sections that each change composition, one-shot
 * reveals on scroll and one carousel the visitor controls.
 */

const EASE = [0.2, 0.8, 0.2, 1] as const;
const HEADLINE = ["See", "what", "your", "arsenal", "is", "really", "worth"];

/** Fades up when scrolled into view, once. */
function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li";
}) {
  const Component = as === "li" ? m.li : m.div;
  return (
    <Component
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </Component>
  );
}

function Overline({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 font-display text-sm font-semibold uppercase tracking-[0.08em] text-muted">
      <span aria-hidden className="h-px w-8 bg-accent" />
      {children}
    </p>
  );
}

function Hero() {
  const session = useActiveSession();
  const { scrollY } = useScroll();
  // The showcase drifts up a little slower than the page: a light parallax.
  const showcaseY = useTransform(scrollY, [0, 600], [0, -60]);

  return (
    <section className="grid min-h-[calc(100dvh-8rem)] grid-cols-1 items-center gap-12 py-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:py-8">
      <div className="min-w-0">
        <m.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <Overline>Collection · Spending · Rank</Overline>
        </m.div>

        <h1
          aria-label="See what your arsenal is really worth"
          className="display-xl mt-5 text-[3rem] sm:text-[4.75rem] xl:text-[5.5rem]"
        >
          {HEADLINE.map((word, i) => (
            <span
              key={word}
              aria-hidden
              className="mr-[0.22em] inline-block overflow-hidden pb-[0.06em] align-bottom"
            >
              <m.span
                className="inline-block"
                initial={{ y: "105%" }}
                animate={{ y: 0 }}
                transition={{ duration: 0.7, ease: EASE, delay: 0.15 + i * 0.07 }}
              >
                {word}
              </m.span>
            </span>
          ))}
        </h1>

        {/* The red slash: the page's one accent mark. */}
        <m.span
          aria-hidden
          className="mt-6 block h-1.5 w-40 origin-left bg-accent"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.7 }}
        />

        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.8 }}
        >
          <p className="mt-6 max-w-lg text-lg text-muted">
            Every skin you own, an estimate of what it cost in VP and pesos, your daily store, and
            your rank history. Built for players in the Philippines.
          </p>
          <p className="mt-3 max-w-lg">
            Your Riot password is never entered here. You sign in on Riot's official page, and your
            access token stays in your browser.
          </p>
          <div className="mt-9 flex flex-wrap gap-5">
            {session ? (
              <Link to="/dashboard" className="btn-valo btn-valo-primary">
                Open your dashboard
              </Link>
            ) : (
              <a href="#connect" className="btn-valo btn-valo-primary">
                Connect your account
              </a>
            )}
            <DemoButton className="btn-valo btn-valo-ghost" label="Try the demo" />
          </div>
        </m.div>
      </div>

      <m.div
        className="min-w-0"
        style={{ y: showcaseY }}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.35 }}
      >
        <SkinShowcase />
      </m.div>
    </section>
  );
}

const BAND = ["Collection", "Spending", "Daily store", "Rank history", "Matches", "Share card"];

/** An angled band naming what the app covers, sliding in once. */
function FeatureBand() {
  return (
    <section aria-label="What ValoVertix covers" className="-mx-4 overflow-hidden">
      <m.ul
        className="band-angled flex flex-wrap items-center justify-center gap-x-6 gap-y-2 bg-accent px-4 py-10 text-accent-ink lg:flex-nowrap lg:gap-x-8"
        initial={{ x: "-6%", opacity: 0 }}
        whileInView={{ x: 0, opacity: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        {BAND.map((item, i) => (
          <li
            key={item}
            className="display-xl flex items-center gap-6 whitespace-nowrap text-2xl lg:gap-8 xl:text-3xl"
          >
            {item}
            {i < BAND.length - 1 && (
              <span aria-hidden className="h-6 w-px rotate-[20deg] bg-accent-ink/40" />
            )}
          </li>
        ))}
      </m.ul>
    </section>
  );
}

function Connect() {
  return (
    <section
      id="connect"
      aria-labelledby="connect-title"
      className="grid scroll-mt-24 items-start gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
    >
      <Reveal>
        <Overline>Connect</Overline>
        <h2 id="connect-title" className="display-xl mt-4 text-5xl sm:text-6xl">
          One link.
          <br />
          Your whole locker.
        </h2>
        <p className="mt-5 max-w-md text-muted">
          Sign in on Riot's page, copy the address it sends you to, and paste it here. No password,
          no account with us, nothing stored on a server.
        </p>
        <Link
          to="/guide"
          className="mt-5 inline-flex min-h-11 items-center underline underline-offset-4 hover:text-accent"
        >
          Step-by-step guide with pictures
        </Link>
      </Reveal>
      <Reveal delay={0.1}>
        {/* Deliberately ValoVertix-styled, never a copy of Riot's login form. */}
        <Panel aria-label="Connect your account" className="panel-raised hud-corners p-0 sm:p-0">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <p className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-muted">
              ValoVertix · Connect
            </p>
            <p className="text-xs text-muted">Token stays in this browser</p>
          </div>
          <div className="p-5 sm:p-6">
            <SignInPanel />
          </div>
        </Panel>
      </Reveal>
    </section>
  );
}

const STEPS = [
  {
    title: "Sign in on Riot",
    text: "The button opens Riot's own sign-in page in a new tab. Your password goes there, never here.",
  },
  {
    title: "Paste the address",
    text: "Riot sends you to a playvalorant.com page. Copy that address and paste it into ValoVertix. The box clears itself.",
  },
  {
    title: "See your account",
    text: "Your browser asks Riot directly for your inventory, store and matches. When the token expires in about an hour, everything stops.",
  },
];

function Steps() {
  return (
    <section aria-labelledby="steps-title">
      <Reveal>
        <Overline>How it works</Overline>
        <h2 id="steps-title" className="display-xl mt-4 text-5xl sm:text-6xl">
          Three steps, one minute
        </h2>
      </Reveal>
      <ol className="mt-10 grid gap-x-8 gap-y-10 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <Reveal
            as="li"
            key={s.title}
            delay={i * 0.1}
            className="relative border-t border-line-strong pt-6"
          >
            <span aria-hidden className="numeral-outline block text-[6.5rem]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="display-xl -mt-6 text-3xl">{s.title}</h3>
            <p className="mt-3 text-muted">{s.text}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

function Features() {
  const tierSets = useStatic("competitiveTiers");
  const tiers = tierSets.data?.[tierSets.data.length - 1]?.tiers ?? [];
  // A spread of rank icons, Iron to Radiant (real art from valorant-api.com).
  const rankIcons = [3, 9, 15, 18, 21, 24, 27]
    .map((t) => tiers.find((x) => x.tier === t))
    .filter((t) => t?.largeIcon);

  return (
    <section aria-labelledby="features-title">
      <Reveal>
        <Overline>What you'll see</Overline>
        <h2 id="features-title" className="display-xl mt-4 text-5xl sm:text-6xl">
          Your account, read properly
        </h2>
      </Reveal>
      <div className="mt-10 grid gap-6 lg:grid-cols-6">
        <Reveal className="lg:col-span-4">
          <Panel className="panel-raised h-full sm:p-8">
            <p className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-accent">
              The headline
            </p>
            <h3 className="display-xl mt-3 text-4xl sm:text-5xl">Spending estimate</h3>
            <p className="mt-4 max-w-xl text-muted">
              Every skin you own priced at Riot's store prices, then converted to pesos using PH VP
              pack prices. It's shown as a range and labelled as an estimate, with a list of what it
              can't see: bundle discounts, Night Market deals and gifts.
            </p>
          </Panel>
        </Reveal>
        <Reveal className="lg:col-span-2" delay={0.08}>
          <Panel className="h-full">
            <h3 className="display-xl text-3xl">Rank and matches</h3>
            <p className="mt-3 text-muted">
              Current and peak rank, RR history, win rate and agent picks.
            </p>
            {rankIcons.length > 0 && (
              <div aria-hidden className="mt-5 flex flex-wrap gap-1">
                {rankIcons.map((t, i) => (
                  <m.img
                    key={t!.tier}
                    src={t!.largeIcon!}
                    alt=""
                    width={40}
                    height={40}
                    className="size-10"
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, ease: EASE, delay: 0.2 + i * 0.05 }}
                  />
                ))}
              </div>
            )}
          </Panel>
        </Reveal>
        {[
          {
            title: "Daily store",
            text: "Today's offers with a reset timer, featured bundles and the Night Market.",
          },
          {
            title: "Collection",
            text: "Skins by weapon with levels, variants and video previews, plus buddies, cards and sprays.",
          },
          {
            title: "Share card",
            text: "A PNG of your spending, collection or rank. Your Riot ID only appears if you choose.",
          },
        ].map((f, i) => (
          <Reveal key={f.title} className="lg:col-span-2" delay={0.05 * i}>
            <div className="h-full border-l border-line-strong py-2 pl-5">
              <h3 className="display-xl text-2xl">{f.title}</h3>
              <p className="mt-2 text-muted">{f.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const STORED = [
  ["Your access token", "In this tab's memory and session storage. Gone when you close the tab."],
  [
    "Remembered accounts, only if you tick the box",
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

function Privacy() {
  return (
    <section
      aria-labelledby="privacy-title"
      className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
    >
      <Reveal>
        <Overline>Privacy</Overline>
        <h2 id="privacy-title" className="display-xl mt-4 text-5xl sm:text-6xl">
          No backend.
          <br />
          No accounts.
        </h2>
        <p className="mt-5 max-w-md text-muted">
          ValoVertix is a page that runs in your browser. Here is exactly what it keeps.
        </p>
        <Link
          to="/privacy"
          className="mt-4 inline-flex min-h-11 items-center underline underline-offset-4 hover:text-accent"
        >
          Read the full privacy details
        </Link>
      </Reveal>
      <Reveal delay={0.1} className="space-y-8">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="display-xl text-2xl">Stored on this device</h3>
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
            <h3 className="display-xl text-2xl">Never stored or sent</h3>
            <ul className="mt-3 list-disc space-y-3 pl-5 marker:text-muted">
              {NOT_STORED.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-l-2 border-warn bg-bg/60 py-3 pl-4 pr-3 text-sm">
          <p className="font-medium">Treat that address like a password for the next hour.</p>
          <p className="mt-1 text-muted">
            Anyone who has it can access your account until it expires. Only paste it into apps you
            trust, and check that you are on{" "}
            <span className="font-medium text-text">{OFFICIAL_DOMAIN}</span>.
          </p>
        </div>
      </Reveal>
    </section>
  );
}

function FinalCta() {
  const session = useActiveSession();
  return (
    <Reveal>
      <section
        aria-labelledby="final-title"
        className="hud-corners flex flex-col items-start gap-8 border border-line bg-bg/60 p-8 sm:p-12 lg:flex-row lg:items-center lg:justify-between"
      >
        <h2 id="final-title" className="display-xl text-5xl sm:text-6xl">
          Ready when
          <br />
          your token is
        </h2>
        <div className="flex flex-wrap gap-5">
          {session ? (
            <Link to="/dashboard" className="btn-valo btn-valo-primary">
              Open your dashboard
            </Link>
          ) : (
            <a href="#connect" className="btn-valo btn-valo-primary">
              Connect your account
            </a>
          )}
          <DemoButton className="btn-valo btn-valo-ghost" label="Try the demo" />
        </div>
      </section>
    </Reveal>
  );
}

export default function Landing() {
  return (
    <div className="space-y-24 pb-8 sm:space-y-32">
      <Hero />
      <FeatureBand />
      <Connect />
      <Steps />
      <Features />
      <Privacy />
      <FinalCta />
    </div>
  );
}
