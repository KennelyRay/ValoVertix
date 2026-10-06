import type { ReactNode } from "react";
import { RIOT_CONNECT_HOSTS } from "@valovertix/riot";
import { PageHeader } from "@/components/shared";
import { OFFICIAL_DOMAIN } from "@/config/app";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl">{title}</h2>
      <div className="space-y-3 leading-relaxed text-muted [&_strong]:text-text">{children}</div>
    </section>
  );
}

const STORAGE = [
  [
    "Session storage, key vv.sessions",
    "Your access, ID and entitlements tokens for this tab. Cleared when the tab closes.",
  ],
  [
    "IndexedDB, valovertix-vault",
    "Only if you choose “Remember this account”: the same session, encrypted with AES-GCM. The key is non-extractable and stored next to it. Deleted when the token expires.",
  ],
  [
    "IndexedDB, valovertix-assets",
    "Public game data (skin names, images, ranks) cached per game version.",
  ],
  ["Local storage, key vv.settings", "Preferences such as “hide free skins”. No account data."],
  ["Session storage, key vv.demo", "Only in demo mode, to keep the demo running after a reload."],
] as const;

export default function PrivacyRoute() {
  return (
    <article className="max-w-3xl space-y-10">
      <PageHeader title="Privacy">
        Last updated 5 October 2026. Plain language, no surprises.
      </PageHeader>

      <Section title="The short version">
        <p>
          <strong>Your Riot password is never entered here.</strong> You sign in on Riot's official
          page, and your access token stays in your browser. ValoVertix has no server that stores
          anything about you: no database, no accounts, no cookies, no analytics.
        </p>
      </Section>

      <Section title="What the access URL is">
        <p>
          After you sign in, Riot sends your browser to a playvalorant.com address containing an
          access token that lasts about an hour. While it is valid, anyone holding it can read your
          account data and act as you on Riot services. That is why the paste box clears itself
          immediately and the app never puts the token in a web address, log or exported image.
        </p>
      </Section>

      <Section title="Where your data goes">
        <p>
          Your browser talks directly to these Riot addresses. The responses come straight back to
          your browser:
        </p>
        <ul className="list-disc space-y-1 pl-5 font-mono text-sm text-text">
          {RIOT_CONNECT_HOSTS.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        <p>
          <strong>No proxy is used.</strong> We tested every Riot endpoint the app calls and all of
          them allow requests straight from a browser, so nothing passes through a server of ours.
          If that ever changes and a proxy becomes necessary, this page will list every address it
          handles.
        </p>
        <p>Public game data, which contains nothing about you, comes from:</p>
        <ul className="list-disc space-y-1 pl-5 font-mono text-sm text-text">
          <li>https://valorant-api.com (names, content tiers, ranks)</li>
          <li>https://media.valorant-api.com (images)</li>
          <li>https://valorant.dyn.riotcdn.net (skin preview videos, only when you play one)</li>
        </ul>
        <p>
          The site's security policy blocks the page from connecting anywhere else, so a bug or a
          malicious script injected later couldn't quietly send your token to another server.
        </p>
      </Section>

      <Section title="What is stored on your device">
        <dl className="space-y-3">
          {STORAGE.map(([where, what]) => (
            <div key={where}>
              <dt className="font-medium text-text">{where}</dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
        <p>
          The encryption for remembered accounts protects against casual inspection of your
          browser's storage. It does not protect against malware on your computer or other people
          using the same browser profile, because they can use the stored key just like this page
          does.
        </p>
        <p>
          “Forget” on the Accounts page removes one account. “Clear all data” deletes every item
          listed above.
        </p>
      </Section>

      <Section title="Analytics and tracking">
        <p>There are none. No cookies, no tracking pixels, no third-party scripts.</p>
      </Section>

      <Section title="Spotting clones">
        <p>
          The official address is <strong>{OFFICIAL_DOMAIN}</strong>. A copy of this app on another
          address could be modified to steal tokens. Only paste your URL here.
        </p>
      </Section>
    </article>
  );
}
