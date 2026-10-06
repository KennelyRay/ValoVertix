import { useState } from "react";
import { pricedRatio, vpToMoneyRange } from "@valovertix/calc";
import { BarList, LoadingBlock, PageHeader, RequireSession, StatTile } from "@/components/shared";
import { EstimateTag, ErrorNote, Panel, Switch, Tabs } from "@/components/ui/primitives";
import { VP_PRICES } from "@/config/vp-prices";
import { useSpending } from "@/features/data";
import { useSettings } from "@/features/settings-store";
import { EstimateInfo } from "@/features/spending/estimate-notes";
import { apiColor, fmtInt, fmtMoney, fmtPct, fmtVp } from "@/lib/format";

type BreakdownTab = "tier" | "weapon" | "theme";

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
  } = useSpending();
  const includeAgents = useSettings((s) => s.includeAgents);
  const setSettings = useSettings((s) => s.set);
  const [tab, setTab] = useState<BreakdownTab>("tier");
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
  const weaponName = (id: string) => catalog?.weapons.find((w) => w.uuid === id)?.name ?? "Other";
  const breakdown =
    tab === "tier"
      ? spending.byTier.map((b) => {
          const t = tierById.get(b.key);
          return {
            key: b.key,
            label: t?.displayName.replace(/ Edition$/, "") ?? "Unknown tier",
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

  return (
    <div className="space-y-6">
      <Panel aria-labelledby="totals-title" className="panel-raised">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="totals-title" className="text-xl">
            Estimated total
          </h2>
          <EstimateInfo />
        </div>
        <dl className="mt-3 grid gap-6 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <StatTile
            emphasis
            label={
              <span className="inline-flex items-center gap-2">
                In pesos <EstimateTag />
              </span>
            }
            value={fmtMoney(money, currency.format)}
            note="Range: largest-pack rate to smallest-pack rate"
          />
          <StatTile
            label={
              <span className="inline-flex items-center gap-2">
                In VP <EstimateTag />
              </span>
            }
            value={fmtVp(spending.totalVp)}
            note={
              spending.agentCount
                ? `${fmtVp(spending.skinVp)} skins + ${fmtVp(spending.agentVp)} agents`
                : `${spending.priced.length} priced skins`
            }
          />
          <StatTile
            label={
              <span className="inline-flex items-center gap-2">
                Radianite on upgrades <EstimateTag />
              </span>
            }
            value={`${fmtInt(spending.radianite)} RP`}
            note={
              spending.radianiteItems
                ? `${spending.radianiteItems} owned upgrades with a store price`
                : "No priced upgrades found"
            }
          />
        </dl>
        <p className="mt-4 text-sm text-muted">Based on standard PH VP pack prices.</p>
        <div className="mt-2 max-w-xl border-t border-line pt-2">
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
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel aria-labelledby="breakdown-title">
          <h2 id="breakdown-title" className="mb-3 text-xl">
            Where the VP went <EstimateTag className="ml-2 align-middle" />
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
          <h2 id="priced-title" className="text-xl">
            Priced vs unpriced skins
          </h2>
          <p className="mt-2 text-sm text-muted">
            Only skins with a current single-item store price count toward the total.
          </p>
          <div className="mt-4 flex h-3 gap-0.5" aria-hidden>
            <div className="h-full bg-text" style={{ width: `${ratio * 100}%` }} />
            <div className="h-full flex-1 bg-line-strong" />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-4">
            <StatTile
              label="Priced (counted)"
              value={fmtInt(spending.priced.length)}
              note={fmtPct(ratio)}
            />
            <StatTile
              label="Unpriced (not counted)"
              value={fmtInt(spending.unpriced.length)}
              note={fmtPct(1 - ratio || 0)}
            />
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

      <Panel aria-labelledby="top-title">
        <h2 id="top-title" className="text-xl">
          Most expensive skins you own <EstimateTag className="ml-2 align-middle" />
        </h2>
        {spending.priced.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            None of your skins have a store price right now.
          </p>
        ) : (
          <ol className="mt-4 divide-y divide-line">
            {spending.priced.slice(0, 10).map((p, i) => {
              const range = vpToMoneyRange(p.vp, currency.rate);
              const tier = p.owned.skin.tierId ? tierById.get(p.owned.skin.tierId) : undefined;
              return (
                <li key={p.owned.skin.uuid} className="flex items-center gap-3 py-2.5 sm:gap-4">
                  <span className="w-6 shrink-0 font-display text-lg font-bold text-muted tabular-nums">
                    {i + 1}
                  </span>
                  <div className="flex h-12 w-24 shrink-0 items-center justify-center sm:w-32">
                    {p.owned.skin.icon && (
                      <img
                        src={p.owned.skin.icon}
                        alt={p.owned.skin.name}
                        loading="lazy"
                        decoding="async"
                        className="max-h-12 w-auto object-contain"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.owned.skin.name}</p>
                    <p className="text-sm text-muted">
                      {tier?.displayName.replace(/ Edition$/, "") ?? "No tier"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-lg font-bold tabular-nums">{fmtVp(p.vp)}</p>
                    <p className="text-sm text-muted tabular-nums">
                      {fmtMoney(range, currency.format)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>

      <Panel aria-labelledby="packs-title">
        <h2 id="packs-title" className="text-xl">
          VP packs used for the peso estimate
        </h2>
        <p className="mt-1 text-sm text-muted">
          Standard PH store prices captured on 5 October 2026. The low end of the range assumes the
          largest pack, the high end the smallest.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[20rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th scope="col" className="py-2 pr-4 font-medium">
                  VP
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Price
                </th>
                <th scope="col" className="py-2 font-medium">
                  Per VP
                </th>
              </tr>
            </thead>
            <tbody>
              {VP_PRICES.PHP.packs.map((p) => (
                <tr key={p.vp} className="border-b border-line">
                  <td className="py-2 pr-4 tabular-nums">{fmtInt(p.vp)}</td>
                  <td className="py-2 pr-4 tabular-nums">₱{fmtInt(p.price)}</td>
                  <td className="py-2 tabular-nums">₱{(p.price / p.vp).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
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
