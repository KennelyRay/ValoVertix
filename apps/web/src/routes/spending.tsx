import { useState, type ReactNode } from "react";
import type { CatalogSkin, ContentTier } from "@valovertix/assets";
import { pricedRatio, vpToMoneyRange, type PricedSkin } from "@valovertix/calc";
import { Stagger } from "@/components/motion";
import { BarList, LoadingBlock, PageHeader, RequireSession } from "@/components/shared";
import { EstimateTag, ErrorNote, Panel, Switch, Tabs } from "@/components/ui/primitives";
import { VP_PRICES } from "@/config/vp-prices";
import { useSpending } from "@/features/data";
import { useSettings } from "@/features/settings-store";
import { EstimateInfo, TierPriceNote } from "@/features/spending/estimate-notes";
import { cn } from "@/lib/cn";
import { useRememberedTab } from "@/lib/use-remembered-tab";
import { apiColor, fmtInt, fmtMoney, fmtPct, fmtVp } from "@/lib/format";

type BreakdownTab = "tier" | "weapon" | "theme";

const EYEBROW = "text-xs font-semibold uppercase tracking-[0.2em] text-muted";
const tierLabel = (t: ContentTier | undefined) =>
  t?.displayName.replace(/ Edition$/, "") ?? "No tier";

function HeroCell({ label, value, note }: { label: ReactNode; value: string; note: string }) {
  return (
    <div className="border-line py-3 sm:border-l sm:px-5 sm:first:border-l-0 sm:first:pl-0">
      <dt className={cn(EYEBROW, "flex items-center gap-2")}>{label}</dt>
      <dd className="mt-1 font-display text-3xl font-bold leading-none tabular-nums">{value}</dd>
      <dd className="mt-1 text-sm text-muted">{note}</dd>
    </div>
  );
}

/** The single most valuable skin, shown like the store's featured banner. */
function Featured({ top, tier }: { top: PricedSkin<CatalogSkin>; tier: ContentTier | undefined }) {
  const color = apiColor(tier?.highlightColor) ?? "var(--color-line-strong)";
  return (
    <figure className="relative flex min-h-60 flex-col justify-end overflow-hidden bg-bg p-4">
      {/* Decorative tier glow and angled band behind the art; caption sits on the solid base. */}
      <div
        aria-hidden
        className="band-angled absolute inset-x-0 top-4 bottom-20 opacity-30"
        style={{ background: `linear-gradient(100deg, transparent, ${color})` }}
      />
      {top.owned.skin.icon && (
        <img
          src={top.owned.skin.icon}
          alt=""
          decoding="async"
          className="absolute inset-x-4 top-4 bottom-24 m-auto max-h-28 w-auto max-w-[85%] object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.6)]"
        />
      )}
      <figcaption className="relative">
        <p className={EYEBROW}>Most valuable skin</p>
        <p className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="font-display text-xl font-bold uppercase leading-tight">
            {top.owned.skin.name}
          </span>
          <span className="font-display text-xl font-bold tabular-nums">{fmtVp(top.vp)}</span>
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
          <span aria-hidden className="size-2" style={{ backgroundColor: color }} />
          {tierLabel(tier)}
        </p>
      </figcaption>
    </figure>
  );
}

function TopSkinCard({
  p,
  rank,
  tier,
  money,
}: {
  p: PricedSkin<CatalogSkin>;
  rank: number;
  tier: ContentTier | undefined;
  money: string;
}) {
  const color = apiColor(tier?.highlightColor);
  return (
    <div className="panel relative flex h-full w-full flex-col overflow-hidden p-3">
      {/* Tier tint fades out before the text, so text contrast is the plain panel's. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-25"
        style={{ background: `linear-gradient(180deg, ${color ?? "transparent"}, transparent)` }}
      />
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ backgroundColor: color }}
      />
      <span aria-hidden className="numeral-outline absolute right-2 top-2 text-5xl tabular-nums">
        {rank}
      </span>
      <div className="relative aspect-[2/1]">
        {p.owned.skin.icon && (
          <img
            src={p.owned.skin.icon}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 m-auto max-h-full max-w-[85%] object-contain"
          />
        )}
      </div>
      <p className="relative mt-3 line-clamp-2 font-medium leading-snug">
        <span className="sr-only">{rank}. </span>
        {p.owned.skin.name}
      </p>
      <p className="relative flex items-center gap-1.5 text-xs text-muted">
        <span aria-hidden className="size-2" style={{ backgroundColor: color }} />
        {tierLabel(tier)}
      </p>
      <div className="relative mt-auto pt-3">
        <p className="font-display text-2xl font-bold tabular-nums">{fmtVp(p.vp)}</p>
        <p className="text-sm text-muted tabular-nums">{money}</p>
      </div>
    </div>
  );
}

function Spending() {
  const {
    spending,
    money,
    currency,
    tierById,
    themeById,
    catalog,
    isPending,
    error,
    agentsAvailable,
    priceSource,
    upgradeToMax,
    exactCount,
    tierCount,
  } = useSpending();
  const includeAgents = useSettings((s) => s.includeAgents);
  const setSettings = useSettings((s) => s.set);
  const [tab, setTab] = useRememberedTab<BreakdownTab>("spending", "tier", [
    "tier",
    "weapon",
    "theme",
  ]);
  const [showUnpriced, setShowUnpriced] = useState(false);

  if (isPending) return <LoadingBlock label="Loading prices and your inventory" />;
  if (error || !spending || !money) {
    return (
      <ErrorNote title="Couldn't build a spending estimate.">
        We need both your owned skins and Riot's store prices. One of them didn't load. Try
        reloading the page.
      </ErrorNote>
    );
  }

  const ratio = pricedRatio(spending);
  const tierOf = (p: PricedSkin<CatalogSkin>) =>
    p.owned.skin.tierId ? tierById.get(p.owned.skin.tierId) : undefined;
  const weaponName = (id: string) => catalog?.weapons.find((w) => w.uuid === id)?.name ?? "Other";
  const breakdown =
    tab === "tier"
      ? spending.byTier.map((b) => {
          const t = tierById.get(b.key);
          return {
            key: b.key,
            label: (
              <span className="inline-flex items-center gap-2">
                {t?.displayIcon ? (
                  <img src={t.displayIcon} alt="" width={20} height={20} className="size-5" />
                ) : null}
                {t ? tierLabel(t) : "Unknown tier"}
              </span>
            ),
            value: b.vp,
            sub: `${b.count}`,
            color: apiColor(t?.highlightColor),
          };
        })
      : tab === "weapon"
        ? spending.byWeapon.map((b) => ({
            key: b.key,
            label: weaponName(b.key),
            value: b.vp,
            sub: `${b.count}`,
          }))
        : spending.byTheme.slice(0, 15).map((b) => ({
            key: b.key,
            label: themeById.get(b.key)?.displayName ?? "No collection",
            value: b.vp,
            sub: `${b.count}`,
          }));
  const top = spending.priced[0];
  const packs = VP_PRICES.PHP.packs;
  const bestPerVp = Math.min(...packs.map((p) => p.price / p.vp));

  return (
    <div className="reveal-children space-y-6">
      <Panel aria-labelledby="totals-title" className="panel-raised">
        <div
          className={cn(
            "grid items-stretch gap-6",
            top && "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]",
          )}
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="totals-title" className={cn(EYEBROW, "flex items-center gap-2")}>
                Estimated total in pesos <EstimateTag />
              </h2>
              <EstimateInfo />
            </div>
            <p className="display-xl mt-3 break-words text-5xl tabular-nums sm:text-6xl">
              {fmtMoney(money, currency.format)}
            </p>
            <p className="mt-2 text-sm text-muted">
              Range: largest-pack rate to smallest-pack rate
            </p>
            <dl
              className={cn(
                "mt-5 grid border-t border-line pt-2",
                upgradeToMax
                  ? "sm:grid-cols-2 sm:[&>div:nth-child(odd)]:border-l-0 sm:[&>div:nth-child(odd)]:pl-0"
                  : "sm:grid-cols-3",
              )}
            >
              <HeroCell
                label={
                  <>
                    In VP <EstimateTag />
                  </>
                }
                value={fmtVp(spending.totalVp)}
                note={
                  spending.agentCount
                    ? `${fmtVp(spending.skinVp)} skins + ${fmtVp(spending.agentVp)} agents`
                    : `${spending.priced.length} priced skins`
                }
              />
              <HeroCell
                label={
                  <>
                    Radianite <EstimateTag />
                  </>
                }
                value={
                  priceSource === "tier" ? "Not available" : `${fmtInt(spending.radianite)} RP`
                }
                note={
                  priceSource === "tier"
                    ? "Needs Riot's price list"
                    : spending.radianiteItems
                      ? `${spending.radianiteItems} owned upgrades with a store price`
                      : "No priced upgrades found"
                }
              />
              {upgradeToMax && (
                <HeroCell
                  label={
                    <>
                      To max upgrades <EstimateTag />
                    </>
                  }
                  value={`${fmtInt(upgradeToMax.total)} RP`}
                  note={
                    upgradeToMax.items
                      ? `${upgradeToMax.items} levels and variants you don't own yet`
                      : "Everything you own is fully upgraded"
                  }
                />
              )}
              <HeroCell
                label="Skins counted"
                value={`${fmtInt(spending.priced.length)} / ${fmtInt(spending.priced.length + spending.unpriced.length)}`}
                note={`${fmtPct(ratio)} have a store price`}
              />
            </dl>
          </div>
          {top && <Featured top={top} tier={tierOf(top)} />}
        </div>

        {priceSource === "tier" && (
          <div className="mt-4">
            <TierPriceNote exactCount={exactCount} tierCount={tierCount} />
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-start justify-between gap-x-8 gap-y-2 border-t border-line pt-3">
          <div className="max-w-xl flex-1">
            <Switch
              checked={includeAgents}
              onChange={(v) => setSettings({ includeAgents: v })}
              label="Include agent unlocks (1000 VP each)"
              description={
                agentsAvailable
                  ? "Off by default: many agents are unlocked with free contracts, not VP. Starter agents are never counted."
                  : "Your agent list didn't load, so agents can't be added."
              }
            />
          </div>
          <p className="pt-3 text-sm text-muted">Based on standard PH VP pack prices.</p>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel aria-labelledby="breakdown-title">
          <h2 id="breakdown-title" className={cn(EYEBROW, "mb-3 flex items-center gap-2")}>
            Where the VP went <EstimateTag />
          </h2>
          <Tabs<BreakdownTab>
            label="Breakdown"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "tier", label: "By tier" },
              { id: "weapon", label: "By weapon" },
              { id: "theme", label: "By collection" },
            ]}
          />
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-4">
            {breakdown.length ? (
              <BarList label={`Estimated VP by ${tab}`} formatValue={fmtVp} rows={breakdown} />
            ) : (
              <p className="text-sm text-muted">No priced skins to break down.</p>
            )}
            {tab === "theme" && (
              <p className="mt-4 text-xs text-muted">
                Grouped by skin collection, the closest thing to a bundle the game data exposes. Top
                15 shown.
              </p>
            )}
          </div>
        </Panel>

        <Panel aria-labelledby="priced-title">
          <h2 id="priced-title" className={EYEBROW}>
            Priced vs unpriced skins
          </h2>
          <p className="mt-2 text-sm text-muted">
            Only skins with a current single-item store price count toward the total.
          </p>
          <div className="mt-5 flex h-2 gap-0.5" aria-hidden>
            <div className="h-full bg-accent" style={{ width: `${ratio * 100}%` }} />
            <div className="h-full flex-1 bg-line-strong" />
          </div>
          <dl className="mt-4 grid grid-cols-2">
            <div>
              <dt className="flex items-center gap-2 text-sm text-muted">
                <span aria-hidden className="size-2 bg-accent" />
                Priced (counted)
              </dt>
              <dd className="mt-1 font-display text-3xl font-bold tabular-nums">
                {fmtInt(spending.priced.length)}
              </dd>
              <dd className="text-sm text-muted">{fmtPct(ratio)}</dd>
            </div>
            <div className="border-l border-line pl-5">
              <dt className="flex items-center gap-2 text-sm text-muted">
                <span aria-hidden className="size-2 bg-line-strong" />
                Unpriced (not counted)
              </dt>
              <dd className="mt-1 font-display text-3xl font-bold tabular-nums">
                {fmtInt(spending.unpriced.length)}
              </dd>
              <dd className="text-sm text-muted">{fmtPct(1 - ratio || 0)}</dd>
            </div>
          </dl>
          <button
            type="button"
            aria-expanded={showUnpriced}
            aria-controls="unpriced-list"
            onClick={() => setShowUnpriced((v) => !v)}
            className="mt-4 inline-flex min-h-11 items-center text-sm underline underline-offset-4 hover:text-accent"
          >
            {showUnpriced
              ? "Hide unpriced skins"
              : `List the ${spending.unpriced.length} unpriced skins`}
          </button>
          {showUnpriced && (
            <ul id="unpriced-list" className="mt-2 max-h-80 space-y-1 overflow-y-auto pr-2 text-sm">
              {spending.unpriced.map((u) => (
                <li
                  key={u.owned.skin.uuid}
                  className="flex justify-between gap-3 border-b border-line py-1.5"
                >
                  <span className="min-w-0 truncate">{u.owned.skin.name}</span>
                  <span className="shrink-0 text-muted">
                    {u.reason === "contract" ? "Battle pass or contract" : "No store offer"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <section aria-labelledby="top-title" className="space-y-4">
        <h2 id="top-title" className="flex items-center gap-3 text-3xl">
          Most expensive skins you own <EstimateTag />
        </h2>
        {spending.priced.length === 0 ? (
          <p className="text-sm text-muted">None of your skins have a store price right now.</p>
        ) : (
          <Stagger as="ol" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {spending.priced.slice(0, 10).map((p, i) => (
              <Stagger.Item as="li" key={p.owned.skin.uuid} className="flex">
                <TopSkinCard
                  p={p}
                  rank={i + 1}
                  tier={tierOf(p)}
                  money={fmtMoney(vpToMoneyRange(p.vp, currency.rate), currency.format)}
                />
              </Stagger.Item>
            ))}
          </Stagger>
        )}
      </section>

      <section aria-labelledby="packs-title" className="space-y-3">
        <div>
          <h2 id="packs-title" className="text-3xl">
            VP packs used for the peso estimate
          </h2>
          <p className="mt-1 text-sm text-muted">
            Standard PH store prices captured on 5 October 2026. The low end of the range assumes
            the largest pack, the high end the smallest.
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {packs.map((p) => {
            const perVp = p.price / p.vp;
            const best = perVp === bestPerVp;
            return (
              <li
                key={p.vp}
                className={cn(
                  "panel flex flex-col items-center p-4 text-center",
                  best && "panel-active",
                )}
              >
                {best && (
                  <span className="mb-2 bg-accent px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest text-accent-ink">
                    Best rate
                  </span>
                )}
                <p className="font-display text-3xl font-bold tabular-nums">{fmtInt(p.vp)}</p>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">VP</p>
                <p className="mt-3 font-semibold tabular-nums">₱{fmtInt(p.price)}</p>
                <p className="text-xs text-muted tabular-nums">₱{perVp.toFixed(3)} per VP</p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

export default function SpendingRoute() {
  return (
    <RequireSession title="Spending">
      <PageHeader title="Spending">
        An estimate of what your skins cost at today's store prices. Every figure here is an
        estimate.
      </PageHeader>
      <Spending />
    </RequireSession>
  );
}
