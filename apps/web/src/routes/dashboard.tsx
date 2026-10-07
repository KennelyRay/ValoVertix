import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { countBy } from "@valovertix/calc";
import { CURRENCY } from "@valovertix/riot";
import { BarList, LoadingBlock, RequireSession, StatTile } from "@/components/shared";
import { CountUp, Stagger } from "@/components/motion";
import { EstimateTag, ErrorNote, Panel, Skeleton } from "@/components/ui/primitives";
import { useSpending, useStatic, useWallet } from "@/features/data";
import { IdentityHeader, PlayerCardShowcase } from "@/features/dashboard/profile";
import { EstimateInfo, TierPriceNote } from "@/features/spending/estimate-notes";
import { useWishlistHits } from "@/features/wishlist/use-wishlist-hits";
import { WishlistShopNotice } from "@/features/wishlist/wishlist-view";
import { formatMoney } from "@valovertix/calc";
import { apiColor, fmtInt, fmtVp } from "@/lib/format";

function WishlistNotice() {
  const { hits } = useWishlistHits();
  if (!hits.length) return null;
  return (
    <Stagger.Item className="max-lg:order-2">
      <WishlistShopNotice hits={hits} compact />
    </Stagger.Item>
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
      <h2 id="wallet-title" className="text-xl">
        Wallet
      </h2>
      {wallet.isError ? (
        <p className="mt-3 text-sm text-muted">Couldn't load your wallet.</p>
      ) : (
        <dl className="mt-3 space-y-3">
          {rows.map((r) => {
            const icon = currencies.data?.find((c) => c.uuid === r.id)?.displayIcon;
            return (
              <div key={r.id} className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-sm text-muted">
                  {icon && <img src={icon} alt="" width={20} height={20} className="size-5" />}
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

function Dashboard() {
  const {
    owned,
    spending,
    money,
    currency,
    tierById,
    tiers,
    catalog,
    isPending,
    error,
    priceSource,
    exactCount,
    tierCount,
  } = useSpending();

  const tierCounts = useMemo(
    () => (owned ? countBy(owned, (o) => o.skin.tierId) : new Map()),
    [owned],
  );
  const weaponName = (id: string) => catalog?.weapons.find((w) => w.uuid === id)?.name ?? "Other";
  const peso = (n: number) => formatMoney(Math.round(n), currency.format, { wholeUnits: true });

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[16.75rem_minmax(0,1fr)]">
      <Stagger className="space-y-6 max-lg:contents lg:sticky lg:top-20">
        <Stagger.Item className="max-lg:order-1">
          <PlayerCardShowcase />
        </Stagger.Item>
        <Stagger.Item className="max-lg:order-5">
          <Wallet />
        </Stagger.Item>
      </Stagger>

      <Stagger className="min-w-0 space-y-6 max-lg:contents">
        <Stagger.Item className="max-lg:order-2">
          <IdentityHeader />
        </Stagger.Item>
        <WishlistNotice />

        {error && !owned ? (
          <ErrorNote title="Couldn't load your collection.">
            Riot didn't return your owned items. Your rank and wallet may still show below.
          </ErrorNote>
        ) : null}

        <Stagger.Item className="max-lg:order-3">
          <Panel aria-labelledby="value-title" className="panel-raised min-h-72 sm:min-h-60">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="value-title" className="text-xl">
                Estimated collection value
              </h2>
              <EstimateInfo />
            </div>
            {isPending ? (
              <LoadingBlock label="Loading your collection" className="mt-4" />
            ) : spending && money ? (
              <>
                <dl className="mt-3 grid gap-6 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                  <StatTile
                    emphasis
                    label={
                      <span className="inline-flex items-center gap-2">
                        In pesos <EstimateTag />
                      </span>
                    }
                    value={
                      <>
                        <CountUp value={money.low} format={peso} />
                        {money.high !== money.low && (
                          <>
                            –<CountUp value={money.high} format={peso} />
                          </>
                        )}
                      </>
                    }
                    note="Largest pack rate to smallest pack rate"
                  />
                  <StatTile
                    label={
                      <span className="inline-flex items-center gap-2">
                        In VP <EstimateTag />
                      </span>
                    }
                    value={<CountUp value={spending.totalVp} format={fmtVp} />}
                    note={`${spending.priced.length} priced skins`}
                  />
                </dl>
                <p className="mt-4 text-sm text-muted">
                  {priceSource === "tier"
                    ? `${spending.unpriced.length} battle pass and contract skins aren't counted.`
                    : `${spending.unpriced.length} skins have no store price (battle pass, events, exclusives) and aren't counted.`}{" "}
                  <Link
                    to="/spending"
                    className="text-text underline underline-offset-4 hover:text-accent"
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
        </Stagger.Item>

        <Stagger.Item className="grid gap-6 max-lg:order-4 md:grid-cols-2 xl:grid-cols-3">
          <Panel aria-labelledby="count-title">
            <h2 id="count-title" className="text-xl">
              Skins owned
            </h2>
            {owned ? (
              <>
                <p className="mt-2 font-display text-5xl font-bold tabular-nums">
                  <CountUp value={owned.length} format={fmtInt} />
                </p>
                <dl className="mt-4 space-y-1.5 text-sm">
                  {[...tiers]
                    .sort((a, b) => b.rank - a.rank)
                    .map((t) => (
                      <div key={t.uuid} className="flex items-center justify-between gap-2">
                        <dt className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="size-2.5"
                            style={{ backgroundColor: apiColor(t.highlightColor) }}
                          />
                          {t.displayName.replace(/ Edition$/, "")}
                        </dt>
                        <dd className="tabular-nums">
                          {fmtInt(tierCounts.get(t.uuid.toLowerCase()) ?? 0)}
                        </dd>
                      </div>
                    ))}
                  {(tierCounts.get("unknown") ?? 0) > 0 && (
                    <div className="flex justify-between gap-2">
                      <dt>No tier</dt>
                      <dd className="tabular-nums">{fmtInt(tierCounts.get("unknown") ?? 0)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-2 border-t border-line pt-1.5 text-muted">
                    <dt>Of these, battle pass and contract rewards</dt>
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

          <Panel aria-labelledby="tier-title">
            <h2 id="tier-title" className="text-xl">
              Estimated VP by tier
            </h2>
            <div className="mt-4">
              {spending ? (
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
              ) : (
                <LoadingBlock label="Loading tier breakdown" />
              )}
            </div>
          </Panel>

          <Panel aria-labelledby="weapon-title">
            <h2 id="weapon-title" className="text-xl">
              Top 5 weapons by skin spend
            </h2>
            <div className="mt-4">
              {spending ? (
                spending.byWeapon.length ? (
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
                )
              ) : (
                <LoadingBlock label="Loading weapon breakdown" />
              )}
            </div>
          </Panel>
        </Stagger.Item>
      </Stagger>
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
