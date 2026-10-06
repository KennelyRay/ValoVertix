import { PageHeader } from "@/components/shared";

export default function TermsRoute() {
  return (
    <article className="max-w-3xl space-y-8 leading-relaxed">
      <PageHeader title="Terms">Last updated 5 October 2026.</PageHeader>
      <section className="space-y-3">
        <h2 className="text-2xl">Not affiliated with Riot Games</h2>
        <p className="text-muted">
          ValoVertix is a fan-made tool. It is not endorsed by or affiliated with Riot Games.
          VALORANT and Riot Games are trademarks of Riot Games, Inc. Game images are loaded from
          valorant-api.com and remain Riot's property.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl">Unofficial endpoints</h2>
        <p className="text-muted">
          The app reads your data through the same unofficial endpoints the game client uses. Riot
          can change or close them at any time, and using them may not be permitted by Riot's own
          terms. You decide whether to connect your account, and you do so at your own risk.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl">Estimates, not records</h2>
        <p className="text-muted">
          Spending figures are estimates based on current store prices and standard PH VP pack
          prices. They are not your purchase history and shouldn't be used as financial records.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl">No warranty</h2>
        <p className="text-muted">
          The app is provided as it is, without any warranty. We aren't liable for losses from using
          it, including anything that happens to your account if you share your access URL with
          someone else.
        </p>
      </section>
    </article>
  );
}
