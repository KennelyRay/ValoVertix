import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { countBy } from "@valovertix/calc";
import { CURRENCY } from "@valovertix/riot";
import { BarList, LoadingBlock, RankBadge, RequireSession, StatTile } from "@/components/shared";
import { EstimateTag, ErrorNote, Panel, Skeleton } from "@/components/ui/primitives";
import { accountLabel } from "@/features/auth/account-bar";
import { useActiveSession } from "@/features/auth/session-store";
import {
  useAccountXp,
  useLoadout,
  useRanks,
  useSpending,
  useStatic,
  useWallet,
} from "@/features/data";
import { EstimateInfo, TierPriceNote } from "@/features/spending/estimate-notes";
import { apiColor, fmtInt, fmtMoney, fmtVp } from "@/lib/format";

function Banner() {
  const session = useActiveSession()!;
  const loadout = useLoadout();
  const xp = useAccountXp();
  const cards = useStatic("playerCards");
  const titles = useStatic("titles");
  const { current, peak, tiers, mmr } = useRanks();

  const card = cards.data?.find(
    (c) => c.uuid.toLowerCase() === loadout.data?.PlayerCardID.toLowerCase(),
  );
  const title = titles.data?.find(
    (t) => t.uuid.toLowerCase() === loadout.data?.PlayerTitleID.toLowerCase(),
  );
  const level = xp.data?.Level ?? loadout.data?.AccountLevel;

  return (
    <section aria-label="Account" className="relative overflow-hidden border border-line">
      {card?.wideArt ? (
        <img
          src={card.wideArt}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-left opacity-50"
          decoding="async"
        />
      ) : (
        <div className="absolute inset-0 bg-surface" />
      )}
      {/* Scrim keeps text readable over any card art. */}
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-bg/40" />
      <div className="relative flex flex-wrap items-end justify-between gap-6 p-5 sm:p-6">
        <div className="min-w-0">
          <p className="text-sm text-muted">
            {title?.titleText ?? (loadout.isPending ? " " : "No title equipped")}
          </p>
          <h1 className="truncate text-4xl sm:text-5xl">{accountLabel(session)}</h1>
          <p className="mt-1 text-muted">
            {level !== undefined ? (
              <>
                Account level <span className="text-text tabular-nums">{level}</span>
              </>
            ) : xp.isPending ? (
              "Loading level…"
            ) : (
              "Level unavailable"
            )}
          </p>
        </div>
        <dl className="flex flex-wrap gap-6">
          <div>
            <dt className="mb-1 text-sm text-muted">Current rank</dt>
            <dd>
              {mmr.isPending ? (
                <Skeleton className="h-10 w-36" />
              ) : (
                <RankBadge tier={current?.tier} rr={current?.rr} tiers={tiers} />
              )}
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-sm text-muted">Peak rank</dt>
            <dd>
              {mmr.isPending ? (
                <Skeleton className="h-10 w-36" />
              ) : (
                <RankBadge tier={peak?.tier} tiers={tiers} />
              )}
            </dd>
          </div>
        </dl>
      </div>
    </section>
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
                <dt className="flex items-center gap-2 text-muted">
                  {icon && <img src={icon} alt="" width={20} height={20} className="size-5" />}
                  {r.label}
                </dt>
                <dd className="font-display text-2xl font-bold tabular-nums">
                  {wallet.data ? fmtInt(wallet.data[r.id] ?? 0) : <Skeleton className="h-6 w-16" />}
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
  } = useSpending();

  const tierCounts = useMemo(
    () => (owned ? countBy(owned, (o) => o.skin.tierId) : new Map()),
    [owned],
  );
  const weaponName = (id: string) => catalog?.weapons.find((w) => w.uuid === id)?.name ?? "Other";

  return (
    <div className="space-y-6">
      <Banner />

      {error && !owned ? (
        <ErrorNote title="Couldn't load your collection.">
          Riot didn't return your owned items. Your rank and wallet may still show below.
        </ErrorNote>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel aria-labelledby="value-title" className="panel-raised min-h-80 lg:min-h-60">
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
                  value={fmtMoney(money, currency.format)}
                  note="Largest pack rate to smallest pack rate"
                />
                <StatTile
                  label={
                    <span className="inline-flex items-center gap-2">
                      In VP <EstimateTag />
                    </span>
                  }
                  value={fmtVp(spending.totalVp)}
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
                  <TierPriceNote compact />
                </div>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Store prices didn't load, so there's no estimate yet.
            </p>
          )}
        </Panel>
        <Wallet />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Panel aria-labelledby="count-title">
          <h2 id="count-title" className="text-xl">
            Skins owned
          </h2>
          {owned ? (
            <>
              <p className="mt-2 font-display text-5xl font-bold tabular-nums">
                {fmtInt(owned.length)}
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
