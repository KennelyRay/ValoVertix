import { useDeferredValue, useId, useMemo, useState } from "react";
import type { CatalogSkin, ContentTier } from "@valovertix/assets";
import { groupByCollection, vpToMoneyRange } from "@valovertix/calc";
import { LoadingBlock } from "@/components/shared";
import { Dropdown } from "@/components/ui/dropdown";
import { Dialog, EmptyNote, ErrorNote, EstimateTag, Switch } from "@/components/ui/primitives";
import { useSettings } from "@/features/settings-store";
import { useSpending, useStatic } from "@/features/data";
import { cn } from "@/lib/cn";
import { apiColor, fmtInt, fmtMoney, fmtPct, fmtVp } from "@/lib/format";

type Sort = "complete" | "owned" | "name";
type Show = "all" | "complete" | "incomplete";

interface BundleRow {
  themeId: string;
  name: string;
  art: string | null;
  skins: CatalogSkin[];
  ownedIds: Set<string>;
  ownedCount: number;
  total: number;
  /** Every skin is a battle pass, contract or no-tier reward: nothing was bought. */
  free: boolean;
  /** VP to buy the missing skins at today's single-item prices, and how many have no price. */
  missingVp: number;
  missingUnpriced: number;
  priceById: Map<string, number>;
}

/**
 * Bundles as collections: Riot has no "owned bundles" list, so skins are
 * grouped by their collection and matched to the store bundle of the same
 * name for its art. Progress counts weapon skins only.
 */
export function useBundles() {
  const { catalog, owned, tierById, themeById, isPending, error, priceOf } = useSpending();
  const bundles = useStatic("bundles");

  const rows = useMemo<BundleRow[] | null>(() => {
    if (!catalog || !owned) return null;
    const bundleByName = new Map(
      (bundles.data ?? []).map((b) => [b.displayName.trim().toLowerCase(), b]),
    );
    return groupByCollection(catalog.skins, owned).map((g) => {
      const name = themeById.get(g.themeId)?.displayName ?? "Unnamed collection";
      const bundle = bundleByName.get(name.trim().toLowerCase());
      const ownedIds = new Set(g.owned.map((o) => o.skin.uuid));
      const priceById = new Map<string, number>();
      let missingVp = 0;
      let missingUnpriced = 0;
      for (const s of g.skins) {
        if (ownedIds.has(s.uuid)) continue;
        const vp = priceOf(s);
        if (vp === undefined) missingUnpriced += 1;
        else {
          priceById.set(s.uuid, vp);
          missingVp += vp;
        }
      }
      return {
        themeId: g.themeId,
        name,
        art: bundle?.displayIcon ?? null,
        skins: [...g.skins].sort((a, b) => a.weaponName.localeCompare(b.weaponName)),
        ownedIds,
        missingVp,
        missingUnpriced,
        priceById,
        ownedCount: g.owned.length,
        total: Math.max(g.skins.length, g.owned.length),
        free: (g.skins.length ? g.skins : g.owned.map((o) => o.skin)).every(
          (s) => s.isContractReward || !s.tierId,
        ),
      };
    });
  }, [catalog, owned, bundles.data, themeById, priceOf]);

  const hideFree = useSettings((s) => s.hideFreeBundles);
  const shown = useMemo(
    () => (rows && hideFree ? rows.filter((r) => !r.free) : rows),
    [rows, hideFree],
  );

  return {
    rows,
    /** Rows after the "hide free collections" preference. */
    shown,
    hiddenFree: rows && shown ? rows.length - shown.length : 0,
    tierById,
    isPending: isPending || (bundles.isPending && !bundles.isError),
    error,
  };
}

function Collage({ skins }: { skins: CatalogSkin[] }) {
  const pics = skins.filter((s) => s.icon).slice(0, 3);
  return (
    <div className="grid h-full grid-cols-3 items-center gap-2 bg-bg/60 p-4">
      {pics.map((s) => (
        <img
          key={s.uuid}
          src={s.icon!}
          alt=""
          loading="lazy"
          className="max-h-16 w-full object-contain"
        />
      ))}
    </div>
  );
}

function Progress({ owned, total }: { owned: number; total: number }) {
  const ratio = total ? owned / total : 0;
  const complete = owned >= total && total > 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className={cn("font-semibold", complete ? "text-win" : "text-text")}>
          {complete ? "Complete" : `${fmtInt(owned)} / ${fmtInt(total)} skins`}
        </span>
        <span className="tabular-nums text-muted">{fmtPct(ratio)}</span>
      </div>
      <div className="mt-1.5 h-1.5 bg-line" aria-hidden>
        <div
          className={cn("h-full transition-[width] duration-500", complete ? "bg-win" : "bg-text")}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

/** "About 3,550 VP to complete", or nothing once complete. */
function CostToComplete({ row, detailed = false }: { row: BundleRow; detailed?: boolean }) {
  const { currency } = useSpending();
  if (row.ownedCount >= row.total) return null;
  const missing = row.total - row.ownedCount;
  if (!row.missingVp) {
    return detailed ? (
      <p className="text-sm text-muted">
        The missing {missing === 1 ? "skin has" : `${missing} skins have`} no store price, so
        there's no cost to show.
      </p>
    ) : null;
  }
  if (!detailed) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>
          To complete: <span className="font-semibold text-text">{fmtVp(row.missingVp)}</span>
        </span>
        <EstimateTag />
      </p>
    );
  }
  return (
    <div className="border-l-2 border-accent bg-raised px-4 py-3">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        Cost to complete <EstimateTag />
      </p>
      <p className="mt-1 font-display text-3xl font-bold tabular-nums">{fmtVp(row.missingVp)}</p>
      <p className="text-sm text-muted tabular-nums">
        {fmtMoney(vpToMoneyRange(row.missingVp, currency.rate), currency.format)} for{" "}
        {missing - row.missingUnpriced} missing{" "}
        {missing - row.missingUnpriced === 1 ? "skin" : "skins"} at single-item prices
      </p>
      {row.missingUnpriced > 0 && (
        <p className="mt-1 text-xs text-muted">
          {row.missingUnpriced} more {row.missingUnpriced === 1 ? "has" : "have"} no store price and
          {row.missingUnpriced === 1 ? " isn't" : " aren't"} counted.
        </p>
      )}
    </div>
  );
}

function BundleDetail({ row, tierById }: { row: BundleRow; tierById: Map<string, ContentTier> }) {
  return (
    <div className="space-y-5">
      {row.art && (
        <img src={row.art} alt="" className="aspect-[16/7] w-full bg-raised object-cover" />
      )}
      <Progress owned={row.ownedCount} total={row.total} />
      <CostToComplete row={row} detailed />
      <ul className="divide-y divide-line border-y border-line">
        {row.skins.map((s) => {
          const has = row.ownedIds.has(s.uuid);
          const tier = s.tierId ? tierById.get(s.tierId) : undefined;
          return (
            <li key={s.uuid} className={cn("flex items-center gap-3 py-2.5", !has && "opacity-60")}>
              <div className="flex h-10 w-24 shrink-0 items-center justify-center">
                {s.icon && (
                  <img
                    src={s.icon}
                    alt=""
                    loading="lazy"
                    className="max-h-10 w-auto object-contain"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.name}</p>
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  {tier && (
                    <span
                      aria-hidden
                      className="size-2"
                      style={{ backgroundColor: apiColor(tier.highlightColor) }}
                    />
                  )}
                  {s.weaponName}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 text-right text-xs font-semibold",
                  has ? "text-win" : "text-muted",
                )}
              >
                {has ? "Owned" : "Not owned"}
                {!has && row.priceById.has(s.uuid) && (
                  <span className="block font-normal tabular-nums">
                    {fmtVp(row.priceById.get(s.uuid)!)}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">
        Counts weapon skins in this collection. Store bundles can also include buddies, cards and
        sprays.
      </p>
    </div>
  );
}

export function BundlesView() {
  const { shown: rows, hiddenFree, tierById, isPending, error } = useBundles();
  const hideFree = useSettings((s) => s.hideFreeBundles);
  const setSettings = useSettings((s) => s.set);
  const [sort, setSort] = useState<Sort>("complete");
  const [show, setShow] = useState<Show>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<BundleRow | null>(null);
  const q = useDeferredValue(query.trim().toLowerCase());
  const searchId = useId();

  const visible = useMemo(() => {
    if (!rows) return [];
    const done = (r: BundleRow) => r.ownedCount >= r.total;
    return rows
      .filter((r) => (show === "complete" ? done(r) : show === "incomplete" ? !done(r) : true))
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .sort((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name)
          : sort === "owned"
            ? b.ownedCount - a.ownedCount || a.name.localeCompare(b.name)
            : b.ownedCount / b.total - a.ownedCount / a.total || b.total - a.total,
      );
  }, [rows, sort, show, q]);

  if (isPending) return <LoadingBlock label="Loading your bundles" />;
  if (error || !rows) {
    return <ErrorNote title="Couldn't load your collections.">Try reloading the page.</ErrorNote>;
  }
  const freeToggle = (
    <Switch
      checked={hideFree}
      onChange={(v) => setSettings({ hideFreeBundles: v })}
      label="Hide battle pass and free collections"
      description="Collections where every skin came from a battle pass, contract or event"
    />
  );
  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <div className="max-w-xl">{freeToggle}</div>
        <EmptyNote title="No collections yet">
          {hiddenFree > 0
            ? `${hiddenFree} free collections are hidden. Turn the switch off to see them.`
            : "Skins you own from a collection or bundle show up here."}
        </EmptyNote>
      </div>
    );
  }

  const complete = rows.filter((r) => r.ownedCount >= r.total).length;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <label
            htmlFor={searchId}
            className="mb-1 block font-display text-xs font-semibold uppercase tracking-[0.08em] text-muted"
          >
            Search bundles
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Bundle name, e.g. Reaver"
            className="min-h-11 w-full border border-line-strong bg-bg/70 px-3 placeholder:text-faint"
          />
        </div>
        <Dropdown<Sort>
          label="Sort by"
          value={sort}
          onChange={setSort}
          options={[
            { value: "complete", label: "Most complete" },
            { value: "owned", label: "Most skins owned" },
            { value: "name", label: "Name, A to Z" },
          ]}
        />
        <Dropdown<Show>
          label="Show"
          value={show}
          onChange={setShow}
          options={[
            { value: "all", label: "All collections", hint: rows.length },
            { value: "complete", label: "Complete", hint: complete },
            { value: "incomplete", label: "Still missing skins", hint: rows.length - complete },
          ]}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 border-b border-line pb-3">
        <p className="text-sm text-muted" aria-live="polite">
          {fmtInt(visible.length)} of {fmtInt(rows.length)} collections, {fmtInt(complete)} complete
          {hiddenFree > 0 && `, ${fmtInt(hiddenFree)} free collections hidden`}
        </p>
        <div className="w-full sm:w-auto">{freeToggle}</div>
      </div>

      {visible.length === 0 ? (
        <div className="mt-6">
          <EmptyNote title="No collections match" />
        </div>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((r) => (
            <li key={r.themeId} className="flex">
              <button
                type="button"
                onClick={() => setOpen(r)}
                className="panel panel-interactive flex w-full flex-col overflow-hidden p-0 text-left"
              >
                <div className="relative aspect-[16/7] w-full overflow-hidden bg-raised">
                  {r.art ? (
                    <img
                      src={r.art}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Collage skins={r.skins} />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <p className="display-xl truncate text-2xl">{r.name}</p>
                  <Progress owned={r.ownedCount} total={r.total} />
                  <CostToComplete row={r} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog side open={Boolean(open)} onClose={() => setOpen(null)} title={open?.name ?? ""}>
        {open && <BundleDetail row={open} tierById={tierById} />}
      </Dialog>
    </div>
  );
}
