import { useDeferredValue, useId, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import type { CatalogSkin } from "@valovertix/assets";
import { LoadingBlock } from "@/components/shared";
import { EmptyNote, EstimateTag } from "@/components/ui/primitives";
import { useSpending } from "@/features/data";
import { cn } from "@/lib/cn";
import { apiColor, fmtVp } from "@/lib/format";
import { PLACE_LABEL, useWishlistHits, type WishlistHit } from "./use-wishlist-hits";
import { useWishlist } from "./wishlist-store";

/** Star toggle for one skin. */
export function WishlistButton({ skin, className }: { skin: CatalogSkin; className?: string }) {
  const on = useWishlist((s) => s.ids.includes(skin.uuid));
  const toggle = useWishlist((s) => s.toggle);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => toggle(skin.uuid)}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 border px-3 text-sm font-semibold transition-colors",
        on
          ? "border-warn text-warn hover:bg-warn/10"
          : "border-line-strong text-muted hover:border-text hover:text-text",
        className,
      )}
    >
      <Star aria-hidden className={cn("size-4", on && "fill-current")} />
      {on ? "On your wishlist" : "Add to wishlist"}
      <span className="sr-only">: {skin.name}</span>
    </button>
  );
}

/** "2 wishlist skins are in your shop", for the Store page and dashboard. */
export function WishlistShopNotice({
  hits,
  compact = false,
}: {
  hits: WishlistHit[];
  compact?: boolean;
}) {
  if (!hits.length) return null;
  return (
    <section
      aria-label="Wishlist skins in your shop"
      className="border-l-2 border-warn bg-warn/5 px-4 py-3"
    >
      <p className="flex items-center gap-2 font-semibold">
        <Star aria-hidden className="size-4 fill-current text-warn" />
        {hits.length === 1
          ? "A skin from your wishlist is in your shop"
          : `${hits.length} skins from your wishlist are in your shop`}
      </p>
      <ul className="mt-1 space-y-0.5 text-sm">
        {hits.map((h) => (
          <li key={h.skin.uuid}>
            {h.skin.name}
            <span className="text-muted">
              {" "}
              · {PLACE_LABEL[h.place].replace(/^In /, "in ")}
              {h.vp ? ` · ${fmtVp(h.vp)}` : ""}
            </span>
          </li>
        ))}
      </ul>
      {compact && (
        <Link
          to="/store"
          className="mt-2 inline-flex min-h-11 items-center text-sm underline underline-offset-4 hover:text-accent"
        >
          Open the store
        </Link>
      )}
    </section>
  );
}

function SkinThumb({ skin }: { skin: CatalogSkin }) {
  return (
    <div className="relative flex aspect-[2/1] items-center justify-center bg-bg">
      {skin.icon && (
        <img
          src={skin.icon}
          alt=""
          loading="lazy"
          decoding="async"
          className="max-h-[80%] max-w-[85%] object-contain"
        />
      )}
    </div>
  );
}

export function WishlistView() {
  const { catalog, owned, tierById, isPending, priceOf, priceSource } = useSpending();
  const { hits, ids } = useWishlistHits();
  const remove = useWishlist((s) => s.remove);
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim().toLowerCase());
  const searchId = useId();

  const ownedIds = useMemo(() => new Set(owned?.map((o) => o.skin.uuid)), [owned]);
  const hitById = useMemo(() => new Map(hits.map((h) => [h.skin.uuid, h])), [hits]);
  const results = useMemo(
    () =>
      q.length < 2 || !catalog
        ? []
        : catalog.skins
            .filter((s) => !s.isDefault && s.name.toLowerCase().includes(q))
            .slice(0, 24),
    [catalog, q],
  );

  if (isPending || !catalog) return <LoadingBlock label="Loading skins" />;
  const wished = ids.map((id) => catalog.byId.get(id)).filter((s): s is CatalogSkin => Boolean(s));

  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sm text-muted">
        Star skins you want. Your wishlist is saved in this browser only, and the Store page and
        dashboard tell you when one shows up in your shop. There are no notifications, so you'll see
        it the next time you open ValoVertix.
      </p>

      <WishlistShopNotice hits={hits} />

      <section aria-labelledby="wish-title">
        <h2 id="wish-title" className="text-2xl">
          Your wishlist <span className="text-muted">{wished.length}</span>
        </h2>
        {wished.length === 0 ? (
          <div className="mt-3">
            <EmptyNote title="Nothing on your wishlist yet">
              Search below, or open a skin in the Store and add it from there.
            </EmptyNote>
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {wished.map((s) => {
              const tier = s.tierId ? tierById.get(s.tierId) : undefined;
              const vp = priceOf(s);
              const hit = hitById.get(s.uuid);
              return (
                <li key={s.uuid} className={cn("panel flex flex-col p-3", hit && "panel-active")}>
                  <SkinThumb skin={s} />
                  <p className="mt-3 line-clamp-2 font-medium leading-snug">{s.name}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    {tier && (
                      <span
                        aria-hidden
                        className="size-2"
                        style={{ backgroundColor: apiColor(tier.highlightColor) }}
                      />
                    )}
                    {tier?.displayName.replace(/ Edition$/, "") ?? s.weaponName}
                    {ownedIds.has(s.uuid) && <span className="font-medium text-win">Owned</span>}
                  </p>
                  {hit && (
                    <p className="mt-2 text-sm font-semibold text-warn">{PLACE_LABEL[hit.place]}</p>
                  )}
                  <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                    <p className="flex items-center gap-1.5 font-display text-lg font-bold tabular-nums">
                      {vp ? fmtVp(vp) : <span className="text-sm text-muted">No store price</span>}
                      {vp && priceSource === "tier" && <EstimateTag />}
                    </p>
                    <button
                      type="button"
                      onClick={() => remove(s.uuid)}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center text-warn hover:text-text"
                      aria-label={`Remove ${s.name} from wishlist`}
                    >
                      <Star aria-hidden className="size-5 fill-current" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="wish-add-title">
        <h2 id="wish-add-title" className="text-2xl">
          Add skins
        </h2>
        <div className="mt-3 max-w-md">
          <label
            htmlFor={searchId}
            className="mb-1 block font-display text-xs font-semibold uppercase tracking-[0.08em] text-muted"
          >
            Search all skins
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Skin name, e.g. Prime Vandal"
            className="min-h-11 w-full border border-line-strong bg-bg/70 px-3 placeholder:text-faint"
          />
        </div>
        {q.length >= 2 && results.length === 0 && (
          <p className="mt-3 text-sm text-muted">No skins match “{query.trim()}”.</p>
        )}
        {results.length > 0 && (
          <ul
            className="mt-4 divide-y divide-line border-y border-line"
            aria-label="Search results"
          >
            {results.map((s) => (
              <li key={s.uuid} className="flex flex-wrap items-center gap-3 py-2">
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
                  <p className="text-xs text-muted">
                    {s.weaponName}
                    {ownedIds.has(s.uuid) && (
                      <span className="ml-2 font-medium text-win">Owned</span>
                    )}
                  </p>
                </div>
                <WishlistButton skin={s} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
