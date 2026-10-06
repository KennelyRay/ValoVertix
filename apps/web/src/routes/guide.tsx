import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/shared";
import { buttonVariants } from "@/components/ui/button";
import { OFFICIAL_DOMAIN } from "@/config/app";
import { cn } from "@/lib/cn";

/**
 * Illustrated browser frames standing in for screenshots. Token values are
 * shown redacted on purpose. Replace with real screenshots before launch
 * (see README), keeping the redaction.
 */
function BrowserFrame({
  url,
  children,
  highlight = false,
}: {
  url: string;
  children: ReactNode;
  highlight?: boolean;
}) {
  return (
    <figure className="overflow-hidden border border-line-strong bg-surface" aria-hidden>
      <div className="flex items-center gap-2 border-b border-line bg-raised px-3 py-2">
        <div
          className={cn(
            "min-w-0 flex-1 truncate border px-3 py-1.5 font-mono text-xs",
            highlight ? "border-accent text-text" : "border-line text-muted",
          )}
        >
          {url}
        </div>
      </div>
      <div className="flex min-h-36 items-center justify-center p-6 text-center text-sm text-muted">
        {children}
      </div>
    </figure>
  );
}

const STEPS = [
  {
    title: "Open Riot's sign-in page",
    text: "Select “Sign in with Riot” on ValoVertix. It opens auth.riotgames.com in a new tab. Check the address bar says auth.riotgames.com before typing anything.",
    frame: (
      <BrowserFrame url="https://auth.riotgames.com/login">
        <div className="w-full max-w-56 space-y-2">
          <div className="h-9 border border-line-strong" />
          <div className="h-9 border border-line-strong" />
          <div className="h-9 bg-line-strong" />
          <p className="pt-1">Riot's own login form</p>
        </div>
      </BrowserFrame>
    ),
  },
  {
    title: "Sign in as usual",
    text: "Use your Riot username and password, plus any two-factor code. ValoVertix never sees this page.",
    frame: (
      <BrowserFrame url="https://auth.riotgames.com/login">
        <p>Two-factor code, if you have it on</p>
      </BrowserFrame>
    ),
  },
  {
    title: "Copy the address you land on",
    text: "Riot sends you to a playvalorant.com page. It may look blank or redirect; that's fine. Click the address bar, select all, and copy. The address is long and starts with https://playvalorant.com and contains #access_token=.",
    frame: (
      <BrowserFrame
        highlight
        url="https://playvalorant.com/en-us/opt_in/#access_token=eyJ•••••••&id_token=eyJ•••••••&expires_in=3600"
      >
        <p>
          Copy the whole address bar.
          <br />
          On phones: tap the address, then Select all, then Copy.
        </p>
      </BrowserFrame>
    ),
  },
  {
    title: "Paste it into ValoVertix",
    text: "Paste into the box on the ValoVertix page and select “Show my account”. The box clears itself straight away.",
    frame: (
      <BrowserFrame url={`https://${OFFICIAL_DOMAIN}/`}>
        <p>Paste box on the ValoVertix home page</p>
      </BrowserFrame>
    ),
  },
];

export default function GuideRoute() {
  return (
    <article className="max-w-4xl">
      <PageHeader title="How to sign in">
        Four steps, about a minute. You type your password on Riot's site, never here.
      </PageHeader>

      <div role="note" className="mb-10 border border-warn/60 bg-warn/5 p-5">
        <p className="font-display text-xl font-semibold text-warn">
          Only paste this URL into apps you trust.
        </p>
        <p className="mt-1">
          Anyone who has it can access your account until it expires (about 1 hour). ValoVertix's
          only official address is <span className="font-semibold">{OFFICIAL_DOMAIN}</span>. If a
          site with a similar name asks for this URL, it is not us.
        </p>
      </div>

      <ol className="space-y-12">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-center"
          >
            <div>
              <p className="font-display text-lg font-semibold text-muted">Step {i + 1}</p>
              <h2 className="text-3xl">{s.title}</h2>
              <p className="mt-2 leading-relaxed text-muted">{s.text}</p>
            </div>
            {s.frame}
          </li>
        ))}
      </ol>

      <section className="mt-14 space-y-3" aria-labelledby="trouble-title">
        <h2 id="trouble-title" className="text-3xl">
          If it doesn't work
        </h2>
        <dl className="space-y-4">
          <div>
            <dt className="font-medium">“This URL has already expired”</dt>
            <dd className="text-muted">
              The token lasts about an hour. Sign in again for a fresh one.
            </dd>
          </div>
          <div>
            <dt className="font-medium">“This URL isn't from playvalorant.com”</dt>
            <dd className="text-muted">
              You may have copied the Riot login page instead. Copy the address after signing in.
            </dd>
          </div>
          <div>
            <dt className="font-medium">It asks for your region</dt>
            <dd className="text-muted">
              Riot's region lookup failed. Pick the region your account plays in. Players in the
              Philippines choose Asia Pacific.
            </dd>
          </div>
        </dl>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link to="/" className={cn(buttonVariants({ variant: "primary" }))}>
          Go to the sign-in box
        </Link>
        <Link to="/privacy" className={cn(buttonVariants({ variant: "ghost" }))}>
          What happens to your data
        </Link>
      </div>
    </article>
  );
}
