import { useCallback, useDeferredValue, useId, useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import type { CatalogSkin, ContentTier } from "@valovertix/assets";
import { decodeShareLink, skinPrefix } from "@valovertix/calc";
import { LoadingBlock } from "@/components/shared";
import { Dropdown } from "@/components/ui/dropdown";
import { EmptyNote, EstimateTag } from "@/components/ui/primitives";
import { useSkinCatalog } from "@/features/data";
import { cn } from "@/lib/cn";
import { apiColor, fmtDate, fmtInt, fmtVp } from "@/lib/format";

const EYEBROW = "text-xs font-semibold uppercase tracking-[0.2em] text-muted";
type Sort = "tier" | "weapon" | "name";
/** One row on wider screens for up to six stats. */
const STAT_COLS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
  6: "sm:grid-cols-3 lg:grid-cols-6",
};
/** Skins rendered at a time; big collections load more on request. */
const PAGE = 40;

const tierLabel = (t: ContentTier | undefined) =>
  t?.displayName.replace(/ Edition$/, "") ?? "No tier";

function SkinCard({
  skin,
  tier,
  big = false,
}: {
  skin: CatalogSkin;
  tier: ContentTier | undefined;
  big?: boolean;
}) {
  const color = apiColor(tier?.highlightColor);
  return (
    <div className="panel relative flex h-full w-full flex-col overflow-hidden p-3">
      {/* Tier tint fades out above the text, so text sits on the plain panel. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-25"
        style={{ background: `linear-gradient(180deg, ${color ?? "transparent"}, transparent)` }}
      />
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ backgroundColor: color }}
      />
      <div className={cn("relative", big ? "aspect-[16/7]" : "aspect-[2/1]")}>
        {skin.icon && (
          <img
            src={skin.icon}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 m-auto max-h-full max-w-[88%] object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.55)]"
          />
        )}
      </div>
      <p
        className={cn(
          "relative mt-3 line-clamp-2 font-medium leading-snug",
          big && "font-display text-xl font-bold uppercase",
        )}
      >
        {skin.name}
      </p>
      <p className="relative mt-0.5 flex items-center gap-1.5 text-xs text-muted">
        <span aria-hidden className="size-2" style={{ backgroundColor: color }} />
        {tierLabel(tier)} · {skin.weaponName}
      </p>
    </div>
  );
}

function Shared() {
  const hash = useRouterState({ select: (s) => s.location.hash });
  const shared = useMemo(() => decodeShareLink(hash), [hash]);
  const { catalog, tierById } = useSkinCatalog();
  const [weapon, setWeapon] = useState("all");
  const [sort, setSort] = useState<Sort>("tier");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const q = useDeferredValue(query.trim().toLowerCase());
  const searchId = useId();

  const resolved = useMemo(() => {
    if (!shared || !catalog) return null;
    const byPrefix = new Map<string, CatalogSkin>();
    for (const s of catalog.skins)
      if (!byPrefix.has(skinPrefix(s.uuid))) byPrefix.set(skinPrefix(s.uuid), s);
    const skins = shared.skinPrefixes
      .map((p) => byPrefix.get(p))
      .filter((s): s is CatalogSkin => Boolean(s));
    return { skins, missing: shared.skinPrefixes.length - skins.length };
  }, [shared, catalog]);

  const rank = useCallback(
    (s: CatalogSkin) => (s.tierId ? (tierById.get(s.tierId)?.rank ?? -1) : -1),
    [tierById],
  );
  const visible = useMemo(() => {
    if (!resolved) return [];
    return resolved.skins
      .filter((s) => weapon === "all" || s.weaponId === weapon)
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .sort((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name)
          : sort === "weapon"
            ? a.weaponName.localeCompare(b.weaponName) || a.name.localeCompare(b.name)
            : rank(b) - rank(a) || a.name.localeCompare(b.name),
      );
  }, [resolved, weapon, q, sort, rank]);

  if (!shared) {
    return (
      <div className="py-10">
        <EmptyNote title="This link doesn't open a collection">
          It may have been cut off when it was copied. Ask for the full link, or{" "}
          <Link to="/" className="underline underline-offset-4">
            see what ValoVertix does
          </Link>
          .
        </EmptyNote>
      </div>
    );
  }
  if (!resolved) return <LoadingBlock label="Loading skins" className="py-6" />;

  const tierCounts = [...tierById.values()]
    .sort((a, b) => b.rank - a.rank)
    .map((t) => ({ t, n: resolved.skins.filter((s) => s.tierId === t.uuid.toLowerCase()).length }))
    .filter((x) => x.n > 0);
  const total = tierCounts.reduce((s, x) => s + x.n, 0) || 1;
  // Totals travel in the link; older links only have the skin list.
  const c = shared.counts;
  const stats: { label: string; value: string; estimate?: boolean; small?: boolean }[] = [
    ...(c ? [{ label: "Total skins", value: fmtInt(c.totalSkins) }] : []),
    { label: shared.paidOnly ? "Paid skins" : "Skins", value: fmtInt(resolved.skins.length) },
    ...(c
      ? [
          { label: "Complete bundles", value: fmtInt(c.bundles) },
          { label: "Battle pass skins", value: fmtInt(c.battlePass) },
        ]
      : []),
    ...(shared.vp !== null ? [{ label: "Value", value: fmtVp(shared.vp), estimate: true }] : []),
    {
      label: "Top tier",
      value: tierCounts[0] ? `${tierCounts[0].n} ${tierLabel(tierCounts[0].t)}` : "None",
      small: true,
    },
  ];
  const highlights = [...resolved.skins].sort((a, b) => rank(b) - rank(a)).slice(0, 3);
  const weapons = [
    ...new Map(resolved.skins.map((s) => [s.weaponId, s.weaponName])).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));

  return (
    <div className="space-y-10 py-4">
      <section aria-labelledby="shared-title" className="relative isolate">
        <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
          <span aria-hidden className="h-0.5 w-8 bg-accent" />
          Shared collection
        </p>
        <h1 id="shared-title" className="display-xl mt-3 break-words text-5xl sm:text-7xl">
          {shared.name ?? "A shared collection"}
        </h1>
        <p className="mt-2 text-muted">
          {shared.paidOnly ? "Paid skins" : "Skins"} as of {fmtDate(shared.madeAt)}. A snapshot made
          with ValoVertix; it doesn't update.
        </p>

        <dl
          className={cn(
            // Odd counts: the last cell spans the row on phones, so no empty cell shows.
            "mt-6 grid max-w-5xl grid-cols-2 gap-px border border-line bg-line [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1",
            STAT_COLS[stats.length] ?? "sm:grid-cols-3",
          )}
        >
          {stats.map((c) => (
            <div key={c.label} className="bg-surface p-4">
              <dt className={cn(EYEBROW, "flex items-center gap-2")}>
                {c.label}
                {c.estimate && <EstimateTag />}
              </dt>
              <dd
                className={cn(
                  "mt-1 font-display font-bold tabular-nums",
                  c.small ? "text-2xl uppercase" : "text-4xl",
                )}
              >
                {c.value}
              </dd>
            </div>
          ))}
        </dl>

        {tierCounts.length > 0 && (
          <div className="mt-5 max-w-3xl">
            <div className="flex h-2 gap-0.5" aria-hidden>
              {tierCounts.map((x) => (
                <div
                  key={x.t.uuid}
                  style={{ flex: x.n / total, backgroundColor: apiColor(x.t.highlightColor) }}
                />
              ))}
            </div>
            <ul
              className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted"
              aria-label="Skins by tier"
            >
              {tierCounts.map((x) => (
                <li key={x.t.uuid} className="flex items-center gap-1.5">
                  {x.t.displayIcon && <img src={x.t.displayIcon} alt="" className="size-4" />}
                  {tierLabel(x.t)}{" "}
                  <span className="font-semibold text-text tabular-nums">{x.n}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {highlights.length > 0 && (
        <section aria-labelledby="highlights-title">
          <h2 id="highlights-title" className="text-3xl">
            Highlights
          </h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-3">
            {highlights.map((s) => (
              <li key={s.uuid} className="flex">
                <SkinCard skin={s} tier={s.tierId ? tierById.get(s.tierId) : undefined} big />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="all-title">
        <h2 id="all-title" className="text-3xl">
          All skins
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label
              htmlFor={searchId}
              className="mb-1 block font-display text-xs font-semibold uppercase tracking-[0.08em] text-muted"
            >
              Search
            </label>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Skin name"
              className="min-h-11 w-full border border-line-strong bg-bg/70 px-3 placeholder:text-faint"
            />
          </div>
          <Dropdown<string>
            label="Weapon"
            value={weapon}
            onChange={setWeapon}
            options={[
              { value: "all", label: "All weapons", hint: resolved.skins.length },
              ...weapons.map(([id, name]) => ({
                value: id,
                label: name,
                hint: resolved.skins.filter((s) => s.weaponId === id).length,
              })),
            ]}
          />
          <Dropdown<Sort>
            label="Sort by"
            value={sort}
            onChange={setSort}
            options={[
              { value: "tier", label: "Highest tier" },
              { value: "weapon", label: "Weapon" },
              { value: "name", label: "Name, A to Z" },
            ]}
          />
        </div>
        <p className="mt-3 text-sm text-muted" aria-live="polite">
          {fmtInt(visible.length)} of {fmtInt(resolved.skins.length)} skins
          {resolved.missing > 0 &&
            `. ${resolved.missing} more ${resolved.missing === 1 ? "isn't" : "aren't"} in the current game data`}
        </p>
        <ul
          className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
          aria-label="Skins"
        >
          {visible.slice(0, limit).map((s) => (
            <li key={s.uuid} className="cv-auto flex">
              <SkinCard skin={s} tier={s.tierId ? tierById.get(s.tierId) : undefined} />
            </li>
          ))}
        </ul>
        {visible.length > limit && (
          <button
            type="button"
            onClick={() => setLimit((n) => n + PAGE * 2)}
            className="btn-valo mt-5"
          >
            Show {Math.min(PAGE * 2, visible.length - limit)} more
          </button>
        )}
      </section>

      <section className="panel panel-raised flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="display-xl text-3xl">Show off yours</p>
          <p className="mt-1 max-w-xl text-sm text-muted">
            ValoVertix reads your own collection, spending and stats from Riot in your browser, and
            makes cards and links like this one.
          </p>
        </div>
        <Link to="/" className="btn-valo btn-valo-primary">
          See how it works
        </Link>
      </section>
    </div>
  );
}

export default function SharedRoute() {
  return <Shared />;
}
