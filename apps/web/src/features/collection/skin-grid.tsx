import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import type { CatalogSkin, ContentTier } from "@valovertix/assets";
import { upgradeCount, type OwnedSkin } from "@valovertix/calc";
import { apiColor } from "@/lib/format";

type Row =
  | { kind: "header"; key: string; title: string; count: number }
  | { kind: "cards"; key: string; items: OwnedSkin<CatalogSkin>[] };

/** 2 columns on phones up to 6 on desktop. */
function columnsFor(width: number) {
  if (width >= 1200) return 6;
  if (width >= 960) return 5;
  if (width >= 720) return 4;
  if (width >= 480) return 3;
  return 2;
}

export function SkinGrid({
  groups,
  tierById,
  onOpen,
}: {
  groups: { weapon: string; skins: OwnedSkin<CatalogSkin>[] }[];
  tierById: Map<string, ContentTier>;
  onOpen: (s: OwnedSkin<CatalogSkin>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1024);
  const [offset, setOffset] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setWidth(el.clientWidth || 1024);
      setOffset(el.getBoundingClientRect().top + window.scrollY);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cols = columnsFor(width);
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const g of groups) {
      out.push({ kind: "header", key: `h-${g.weapon}`, title: g.weapon, count: g.skins.length });
      for (let i = 0; i < g.skins.length; i += cols) {
        out.push({ kind: "cards", key: `${g.weapon}-${i}`, items: g.skins.slice(i, i + cols) });
      }
    }
    return out;
  }, [groups, cols]);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: (i) => (rows[i]?.kind === "header" ? 56 : width / cols + 40),
    overscan: 4,
    scrollMargin: offset,
  });

  useEffect(() => virtualizer.measure(), [cols, virtualizer]);

  return (
    <div ref={ref} className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((v) => {
        const row = rows[v.index]!;
        return (
          <div
            key={row.key}
            data-index={v.index}
            ref={virtualizer.measureElement}
            className="absolute inset-x-0 top-0"
            style={{ transform: `translateY(${v.start - virtualizer.options.scrollMargin}px)` }}
          >
            {row.kind === "header" ? (
              <h3 className="flex items-baseline gap-2 pb-2 pt-5 text-2xl">
                {row.title}
                <span className="font-sans text-sm font-normal text-muted">{row.count}</span>
              </h3>
            ) : (
              <ul
                className="grid gap-2 pb-2 sm:gap-3 sm:pb-3"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
              >
                {row.items.map((o) => (
                  <li key={o.skin.uuid}>
                    <SkinCard
                      owned={o}
                      tier={o.skin.tierId ? tierById.get(o.skin.tierId) : undefined}
                      onOpen={onOpen}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SkinCard({
  owned,
  tier,
  onOpen,
}: {
  owned: OwnedSkin<CatalogSkin>;
  tier: ContentTier | undefined;
  onOpen: (s: OwnedSkin<CatalogSkin>) => void;
}) {
  const { skin } = owned;
  const upgrades = upgradeCount(owned);
  const maxUpgrades = Math.max(0, skin.levels.length - 1) + Math.max(0, skin.chromas.length - 1);
  return (
    <button
      type="button"
      onClick={() => onOpen(owned)}
      className="panel panel-interactive flex h-full w-full flex-col p-3 text-left"
    >
      <div className="flex aspect-[2/1] items-center justify-center">
        {skin.icon ? (
          <img
            src={skin.icon}
            alt={skin.name}
            loading="lazy"
            decoding="async"
            className="max-h-full w-auto max-w-full object-contain"
          />
        ) : (
          <span className="text-xs text-faint">No image</span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug">{skin.name}</p>
      <p className="mt-auto flex items-center gap-1.5 pt-1 text-xs text-muted">
        {tier && (
          <span
            aria-hidden
            className="size-2 shrink-0"
            style={{ backgroundColor: apiColor(tier.highlightColor) }}
          />
        )}
        <span className="truncate">
          {tier ? tier.displayName.replace(/ Edition$/, "") : "No tier"}
        </span>
        {maxUpgrades > 0 && (
          <span className="ml-auto shrink-0 tabular-nums">
            {upgrades}/{maxUpgrades}
            <span className="sr-only"> upgrades owned</span>
          </span>
        )}
      </p>
    </button>
  );
}
