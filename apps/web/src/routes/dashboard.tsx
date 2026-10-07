import { useMemo, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  ChevronRight,
  LayoutGrid,
  Share2,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import { countBy, rankedSession } from "@valovertix/calc";
import { CURRENCY } from "@valovertix/riot";
import { BarList, LoadingBlock, RequireSession } from "@/components/shared";
import { CountUp, Stagger } from "@/components/motion";
import { EstimateTag, ErrorNote, Panel, Skeleton } from "@/components/ui/primitives";
import { useNow } from "@/features/auth/account-bar";
import { useRanks, useSpending, useStatic, useStorefront, useWallet } from "@/features/data";
import { ProfileHero } from "@/features/dashboard/profile";
import { EstimateInfo, TierPriceNote } from "@/features/spending/estimate-notes";
import { useWishlistHits } from "@/features/wishlist/use-wishlist-hits";
import { WishlistShopNotice } from "@/features/wishlist/wishlist-view";
import { cn } from "@/lib/cn";
import { apiColor, fmtCountdown, fmtInt, fmtVp, titleCase } from "@/lib/format";

const EYEBROW = "text-xs font-semibold uppercase tracking-[0.2em] text-muted";

/** A section heading in the client's style: small caps with a red tick. */
function SectionTitle({
  id,
  children,
  aside,
}: {
  id: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2
        id={id}
        className="flex items-center gap-2.5 font-display text-sm font-bold uppercase tracking-[0.18em]"
      >
        <span aria-hidden className="h-3.5 w-[3px] bg-accent" />
        {children}
      </h2>
      {aside}
    </div>
  );
}

function Wallet() {
  const wallet = useWallet();
  const currencies = useStatic("currencies");
  const rows = [
    { id: CURRENCY.vp, label: "VALORANT Points" },
    { id: CURRENCY.radianite, label: "Radianite" },
    { id: CURRENCY.kingdomCredits, label: "Kingdom Credits" },
  ];
  return (
    <Panel aria-labelledby="wallet-title">
      <SectionTitle id="wallet-title">Wallet</SectionTitle>
      {wallet.isError ? (
        <p className="mt-3 text-sm text-muted">Couldn't load your wallet.</p>
      ) : (
        <dl className="mt-2 divide-y divide-line">
          {rows.map((r) => {
            const icon = currencies.data?.find((c) => c.uuid === r.id)?.displayIcon;
            return (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <dt className="flex items-center gap-2.5 text-sm text-muted">
                  {icon ? (
                    <img src={icon} alt="" width={22} height={22} className="size-[22px]" />
                  ) : (
                    <span aria-hidden className="size-[22px]" />
                  )}
                  {r.label}
                </dt>
                <dd className="font-display text-2xl font-bold tabular-nums">
                  {wallet.data ? (
                    <CountUp value={wallet.data[r.id] ?? 0} format={fmtInt} />
                  ) : (
                    <Skeleton className="h-6 w-16" />
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </Panel>
  );
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** The latest ranked session at a glance, like the client's match history strip. */
function RecentRanked() {
  const { history, tiers } = useRanks();
  const session = rankedSession(history);
  if (!session) return null;
  const games = [...session.games].reverse().slice(-8);
  const now = titleCase(tiers.get(session.after.tier)?.tierName ?? `Tier ${session.after.tier}`);
  return (
    <Panel aria-labelledby="recent-title">
      <SectionTitle
        id="recent-title"
        aside={
          <Link
            to="/stats"
            className="text-xs font-semibold uppercase tracking-wider text-muted hover:text-text"
          >
            Stats
          </Link>
        }
      >
        Last ranked session
      </SectionTitle>
      <p
        className={cn(
          "mt-3 font-display text-4xl font-bold leading-none tabular-nums",
          session.net > 0 ? "text-win" : session.net < 0 ? "text-loss" : "text-text",
        )}
      >
        {signed(session.net)} RR
      </p>
      <p className="mt-1 text-sm text-muted tabular-nums">
        {session.wins}W {session.losses}L · now {now}
      </p>
      <ol aria-label="RR change per game, oldest first" className="mt-3 flex flex-wrap gap-1">
        {games.map((g) => (
          <li
            key={g.matchId}
            className={cn(
              "min-w-10 border-b-2 bg-raised px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums",
              g.delta > 0
                ? "border-win text-win"
                : g.delta < 0
                  ? "border-loss text-loss"
                  : "border-line-strong",
            )}
          >
            {signed(g.delta)}
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/** Shortcuts to the other pages, like the client's side tiles. */
function QuickLinks() {
  const storefront = useStorefront(true);
  const now = useNow(30_000);
  const reset = storefront.data?.daily.remainingSeconds;
  const resetsAt = reset != null ? storefront.dataUpdatedAt + reset * 1000 : null;
  const links: { to: string; label: string; hint: string; icon: LucideIcon }[] = [
    {
      to: "/store",
      label: "Store",
      hint: resetsAt ? `Daily shop resets in ${fmtCountdown(resetsAt - now)}` : "Today's offers",
      icon: ShoppingBag,
    },
    { to: "/stats", label: "Stats", hint: "Matches, rank and weapons", icon: BarChart3 },
    {
      to: "/collection",
      label: "Collection",
      hint: "Skins, bundles and loadout",
      icon: LayoutGrid,
    },
    { to: "/share", label: "Share card", hint: "Images and links", icon: Share2 },
  ];
  return (
    <nav aria-label="Jump to">
      <ul className="grid gap-2">
        {links.map((l) => (
          <li key={l.to}>
            <Link
              to={l.to}
              className="tap group flex min-h-14 items-center gap-3 border border-line bg-surface/80 px-4 py-2 transition-colors hover:border-line-strong hover:bg-raised"
            >
              <l.icon aria-hidden className="size-5 shrink-0 text-accent" />
              <span className="min-w-0 flex-1">
                <span className="block font-display text-base font-bold uppercase leading-tight">
                  {l.label}
                </span>
                <span className="block truncate text-xs text-muted">{l.hint}</span>
              </span>
              <ChevronRight
                aria-hidden
                className="size-4 text-muted transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function CollectionValue() {
  const { spending, money, spent, pricing, isPending, priceSource, exactCount, tierCount } =
    useSpending();
  const cash = pricing.fmtAmount;
  return (
    <Panel aria-labelledby="value-title" className="panel-raised">
      <SectionTitle id="value-title" aside={<EstimateInfo />}>
        Estimated collection value
      </SectionTitle>
      {isPending ? (
        <LoadingBlock label="Loading your collection" className="mt-4" />
      ) : spending && money ? (
        <>
          <p className={cn(EYEBROW, "mt-4 flex items-center gap-2")}>
            Collection value in {pricing.region.currency} <EstimateTag />
          </p>
          <p className="display-xl mt-2 break-words text-5xl tabular-nums sm:text-6xl">
            <CountUp value={money.low} format={cash} />
            {money.high !== money.low && (
              <>
                –<CountUp value={money.high} format={cash} />
              </>
            )}
          </p>
          <p className="mt-1 text-sm text-muted">Largest pack rate to smallest pack rate</p>

          <dl className="mt-5 grid gap-px border border-line bg-line sm:grid-cols-3">
            {spent && (
              <div className="bg-surface p-4">
                <dt className={cn(EYEBROW, "flex items-center gap-2")}>
                  Total spent <EstimateTag />
                </dt>
                <dd className="mt-1 font-display text-3xl font-bold tabular-nums">
                  <CountUp value={spent.price} format={cash} />
                </dd>
                <dd className="text-xs text-muted">Cheapest real VP packs for that VP</dd>
              </div>
            )}
            <div className="bg-surface p-4">
              <dt className={cn(EYEBROW, "flex items-center gap-2")}>
                In VP <EstimateTag />
              </dt>
              <dd className="mt-1 font-display text-3xl font-bold tabular-nums">
                <CountUp value={spending.totalVp} format={fmtVp} />
              </dd>
              <dd className="text-xs text-muted">{spending.priced.length} priced skins</dd>
            </div>
            <div className="bg-surface p-4">
              <dt className={EYEBROW}>Not counted</dt>
              <dd className="mt-1 font-display text-3xl font-bold tabular-nums">
                {fmtInt(spending.unpriced.length)}
              </dd>
              <dd className="text-xs text-muted">
                {priceSource === "tier" ? "Battle pass and contract skins" : "No store price"}
              </dd>
            </div>
          </dl>

          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold">{pricing.label}</span>
            <Link
              to="/settings"
              hash="pricing"
              className="text-muted underline underline-offset-4 hover:text-accent"
            >
              Change region
            </Link>
            <Link
              to="/spending"
              className="text-muted underline underline-offset-4 hover:text-accent"
            >
              See the full breakdown
            </Link>
          </p>
          {priceSource === "tier" && (
            <div className="mt-3">
              <TierPriceNote compact exactCount={exactCount} tierCount={tierCount} />
            </div>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Store prices didn't load, so there's no estimate yet.
        </p>
      )}
    </Panel>
  );
}

function SkinsByTier() {
  const { owned, tiers } = useSpending();
  const counts = useMemo(
    () => (owned ? countBy(owned, (o) => o.skin.tierId) : new Map<string, number>()),
    [owned],
  );
  const rows = [...tiers]
    .sort((a, b) => b.rank - a.rank)
    .map((t) => ({ t, n: counts.get(t.uuid.toLowerCase()) ?? 0 }))
    .filter((x) => x.n > 0);
  const total = rows.reduce((s, x) => s + x.n, 0) || 1;
  return (
    <Panel aria-labelledby="count-title">
      <SectionTitle id="count-title">Skins owned</SectionTitle>
      {owned ? (
        <>
          <p className="mt-3 font-display text-5xl font-bold leading-none tabular-nums">
            <CountUp value={owned.length} format={fmtInt} />
          </p>
          {/* Share of skins per tier, in tier colors. */}
          <div aria-hidden className="mt-4 flex h-2 gap-0.5">
            {rows.map((x) => (
              <div
                key={x.t.uuid}
                style={{ flex: x.n / total, backgroundColor: apiColor(x.t.highlightColor) }}
              />
            ))}
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            {rows.map((x) => (
              <div key={x.t.uuid} className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-2">
                  {x.t.displayIcon ? (
                    <img
                      src={x.t.displayIcon}
                      alt=""
                      width={18}
                      height={18}
                      className="size-[18px]"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="size-2.5"
                      style={{ backgroundColor: apiColor(x.t.highlightColor) }}
                    />
                  )}
                  {x.t.displayName.replace(/ Edition$/, "")}
                </dt>
                <dd className="font-semibold tabular-nums">{fmtInt(x.n)}</dd>
              </div>
            ))}
            {(counts.get("unknown") ?? 0) > 0 && (
              <div className="flex justify-between gap-2">
                <dt className="pl-[26px]">No tier</dt>
                <dd className="font-semibold tabular-nums">{fmtInt(counts.get("unknown") ?? 0)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-2 border-t border-line pt-2 text-muted">
              <dt>Battle pass and contract rewards</dt>
              <dd className="tabular-nums">
                {fmtInt(owned.filter((o) => o.skin.isContractReward).length)}
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <LoadingBlock label="Counting skins" className="mt-3" />
      )}
    </Panel>
  );
}

function SpendBreakdown() {
  const { spending, tierById, catalog } = useSpending();
  const weaponName = (id: string) => catalog?.weapons.find((w) => w.uuid === id)?.name ?? "Other";
  return (
    <Panel aria-labelledby="spend-title">
      <SectionTitle id="spend-title" aside={<EstimateTag />}>
        Where the VP went
      </SectionTitle>
      {spending ? (
        <div className="mt-4 space-y-6">
          <section aria-labelledby="tier-title">
            <h3 id="tier-title" className={EYEBROW}>
              Estimated VP by tier
            </h3>
            <div className="mt-3">
              <BarList
                label="Estimated VP by content tier"
                formatValue={fmtVp}
                rows={spending.byTier.map((b) => {
                  const t = tierById.get(b.key);
                  return {
                    key: b.key,
                    label: t ? t.displayName.replace(/ Edition$/, "") : "Unknown tier",
                    value: b.vp,
                    color: apiColor(t?.highlightColor),
                  };
                })}
              />
            </div>
          </section>
          <section aria-labelledby="weapon-title">
            <h3 id="weapon-title" className={EYEBROW}>
              Top 5 weapons by skin spend
            </h3>
            <div className="mt-3">
              {spending.byWeapon.length ? (
                <BarList
                  label="Top five weapons by estimated skin spend"
                  formatValue={fmtVp}
                  rows={spending.byWeapon.slice(0, 5).map((b) => ({
                    key: b.key,
                    label: weaponName(b.key),
                    value: b.vp,
                    sub: `${b.count} skins`,
                  }))}
                />
              ) : (
                <p className="text-sm text-muted">No priced skins yet.</p>
              )}
            </div>
          </section>
        </div>
      ) : (
        <LoadingBlock label="Loading the breakdown" className="mt-4" />
      )}
    </Panel>
  );
}

function WishlistNotice() {
  const { hits } = useWishlistHits();
  if (!hits.length) return null;
  return (
    <Stagger.Item>
      <WishlistShopNotice hits={hits} compact />
    </Stagger.Item>
  );
}

function Dashboard() {
  const { owned, error } = useSpending();
  return (
    <div className="space-y-6">
      <ProfileHero />

      {error && !owned ? (
        <ErrorNote title="Couldn't load your collection.">
          Riot didn't return your owned items. Your rank and wallet may still show below.
        </ErrorNote>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Stagger className="min-w-0 space-y-6">
          <Stagger.Item>
            <CollectionValue />
          </Stagger.Item>
          <Stagger.Item className="grid items-start gap-6 md:grid-cols-2">
            <SkinsByTier />
            <SpendBreakdown />
          </Stagger.Item>
        </Stagger>

        {/* Side column: on phones it comes first, as the quick glance. */}
        <Stagger className="space-y-6 max-lg:order-first">
          <WishlistNotice />
          <Stagger.Item>
            <Wallet />
          </Stagger.Item>
          <Stagger.Item>
            <RecentRanked />
          </Stagger.Item>
          {/* Phones have the tab bar for this. */}
          <Stagger.Item className="max-lg:hidden">
            <QuickLinks />
          </Stagger.Item>
        </Stagger>
      </div>
    </div>
  );
}

export default function DashboardRoute() {
  return (
    <RequireSession title="Dashboard">
      <Dashboard />
    </RequireSession>
  );
}
