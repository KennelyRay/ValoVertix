import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { indexBy } from "@valovertix/assets";
import { vpToMoneyRange } from "@valovertix/calc";
import { CURRENCY, ITEM_TYPE, type Storefront } from "@valovertix/riot";
import { LoadingBlock, PageHeader, RequireSession } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { EmptyNote, ErrorNote, EstimateTag } from "@/components/ui/primitives";
import { useNow } from "@/features/auth/account-bar";
import { currencyConfig, useOwned, useStatic, useStorefront } from "@/features/data";
import { useStoreItems, type StoreItem } from "@/features/store/use-store-items";
import { cn } from "@/lib/cn";
import { apiColor, fmtMoney, fmtPct, fmtTimeLeft, fmtVp } from "@/lib/format";

/** "Resets in 9h 20m", ticking. `endsAt` is absolute (fetch time + Riot's remaining seconds). */
function TimeLeft({ endsAt, label }: { endsAt: number | null; label: string }) {
  const now = useNow();
  if (endsAt === null) return null;
  return (
    <p className="text-sm text-muted tabular-nums">
      {label} {fmtTimeLeft(endsAt - now)}
    </p>
  );
}

function Peso({ vp }: { vp: number }) {
  const c = currencyConfig();
  return <span className="tabular-nums">{fmtMoney(vpToMoneyRange(vp, c.rate), c.format)}</span>;
}

function ItemArt({ item, className }: { item: StoreItem; className?: string }) {
  if (!item.image) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-center font-display text-lg",
          className,
        )}
      >
        {item.kind === "Title" ? `“${item.name}”` : item.kind}
      </div>
    );
  }
  return (
    // The image is pinned to the box so tall art can't push the text below out of line.
    <div className={cn("relative", className)}>
      <img
        src={item.image}
        alt={item.name}
        loading="lazy"
        decoding="async"
        className={cn(
          "absolute inset-0 h-full w-full",
          item.wide ? "object-cover" : "object-contain",
        )}
      />
    </div>
  );
}

function TierLine({ item, owned }: { item: StoreItem; owned: boolean }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
      {item.tier && (
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2"
            style={{ backgroundColor: apiColor(item.tier.highlightColor) }}
          />
          {item.tier.displayName.replace(/ Edition$/, "")}
        </span>
      )}
      {!item.tier && <span>{item.kind}</span>}
      {owned && <span className="font-medium text-win">Owned</span>}
    </p>
  );
}

function Section({
  id,
  title,
  aside,
  children,
}: {
  id: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id={id} className="text-3xl">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Daily({ sf, endsAt, resolve, owned }: StoreProps) {
  const offers = sf.daily.offers;
  return (
    <Section
      id="daily-title"
      title="Daily offers"
      aside={<TimeLeft endsAt={endsAt(sf.daily.remainingSeconds)} label="Resets in" />}
    >
      {offers.length === 0 ? (
        <EmptyNote title="No daily offers">
          Riot didn't return a daily shop for this account.
        </EmptyNote>
      ) : (
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {offers.map((o) => {
            const reward = o.Rewards[0];
            if (!reward) return null;
            const item = resolve(reward.ItemTypeID, reward.ItemID);
            const vp = o.Cost[CURRENCY.vp] ?? 0;
            return (
              <li key={o.OfferID} className="panel flex flex-col p-3 sm:p-4">
                <ItemArt item={item} className="aspect-[2/1]" />
                <p className="mt-3 line-clamp-2 font-medium leading-snug">{item.name}</p>
                <TierLine item={item} owned={owned.has(reward.ItemID.toLowerCase())} />
                <div className="mt-auto pt-3">
                  <p className="font-display text-2xl font-bold tabular-nums">{fmtVp(vp)}</p>
                  <p className="text-sm text-muted">
                    <Peso vp={vp} />
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function Bundles({ sf, endsAt, resolve, owned }: StoreProps) {
  const bundleData = useStatic("bundles");
  const byId = useMemo(() => indexBy(bundleData.data ?? []), [bundleData.data]);
  if (sf.bundles.length === 0) return null;
  return (
    <Section
      id="bundles-title"
      title={sf.bundles.length === 1 ? "Featured bundle" : "Featured bundles"}
    >
      <div className="space-y-6">
        {sf.bundles.map((b) => {
          const info = byId.get(b.dataAssetId);
          const base = b.totalBase?.[CURRENCY.vp] ?? b.items.reduce((s, i) => s + i.basePrice, 0);
          const price =
            b.totalDiscounted?.[CURRENCY.vp] ?? b.items.reduce((s, i) => s + i.discountedPrice, 0);
          const saving = base > 0 ? 1 - price / base : 0;
          return (
            <article
              key={b.id}
              aria-label={info?.displayName ?? "Bundle"}
              className="panel overflow-hidden"
            >
              <div className="relative">
                {info?.displayIcon ? (
                  <img
                    src={info.displayIcon}
                    alt=""
                    className="aspect-[16/7] w-full bg-raised object-cover"
                    decoding="async"
                  />
                ) : (
                  <div className="aspect-[16/7] w-full bg-raised" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-4 sm:p-6">
                  <div className="min-w-0">
                    {info?.displayNameSubText && (
                      <p className="text-sm text-muted">{info.displayNameSubText}</p>
                    )}
                    <h3 className="text-3xl sm:text-4xl">{info?.displayName ?? "Bundle"}</h3>
                    <TimeLeft endsAt={endsAt(b.remainingSeconds)} label="Leaves the store in" />
                  </div>
                  <div className="text-right">
                    {saving > 0.005 && (
                      <p className="text-sm text-muted">
                        <span className="line-through">{fmtVp(base)}</span> · {fmtPct(saving)} off
                        as a bundle
                      </p>
                    )}
                    <p className="font-display text-3xl font-bold tabular-nums">{fmtVp(price)}</p>
                    <p className="text-sm text-muted">
                      <Peso vp={price} />
                    </p>
                  </div>
                </div>
              </div>
              <ul className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-6 lg:grid-cols-5">
                {b.items.map((i) => {
                  const item = resolve(i.itemTypeId, i.itemId);
                  return (
                    <li
                      key={`${i.itemTypeId}:${i.itemId}`}
                      className="flex flex-col border border-line bg-bg/60 p-3"
                    >
                      <ItemArt item={item} className="aspect-[2/1]" />
                      <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug">
                        {item.name}
                      </p>
                      <TierLine
                        item={item}
                        owned={i.itemTypeId === ITEM_TYPE.skinLevel && owned.has(i.itemId)}
                      />
                      <p className="mt-auto pt-2 text-sm tabular-nums">
                        {i.discountedPrice < i.basePrice ? (
                          <>
                            <span className="text-muted line-through">{fmtVp(i.basePrice)}</span>{" "}
                            {fmtVp(i.discountedPrice)}
                          </>
                        ) : i.basePrice > 0 ? (
                          fmtVp(i.basePrice)
                        ) : (
                          "Included"
                        )}
                      </p>
                    </li>
                  );
                })}
              </ul>
              {b.wholesaleOnly && (
                <p className="px-4 pb-4 text-sm text-muted sm:px-6">
                  Only sold as the full bundle.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </Section>
  );
}

function NightMarket({ sf, endsAt, resolve, owned }: StoreProps) {
  if (!sf.nightMarket || sf.nightMarket.offers.length === 0) return null;
  return (
    <Section
      id="night-title"
      title="Night Market"
      aside={<TimeLeft endsAt={endsAt(sf.nightMarket.remainingSeconds)} label="Ends in" />}
    >
      <p className="-mt-2 text-sm text-muted">
        Your personal discounts. Cards you haven't flipped in the game are shown here too.
      </p>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {sf.nightMarket.offers.map((n) => {
          const reward = n.offer.Rewards[0];
          if (!reward) return null;
          const item = resolve(reward.ItemTypeID, reward.ItemID);
          const base = n.offer.Cost[CURRENCY.vp] ?? 0;
          const price = n.discountedCost[CURRENCY.vp] ?? base;
          const pct = base > 0 ? 1 - price / base : 0;
          return (
            <li key={n.offer.OfferID} className="panel flex flex-col p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="font-display text-xl font-bold text-accent">−{fmtPct(pct)}</span>
                {!n.isSeen && <span className="text-xs text-muted">Not flipped in game</span>}
              </div>
              <ItemArt item={item} className="aspect-[2/1]" />
              <p className="mt-3 line-clamp-2 font-medium leading-snug">{item.name}</p>
              <TierLine item={item} owned={owned.has(reward.ItemID.toLowerCase())} />
              <div className="mt-auto pt-3">
                <p className="text-sm text-muted line-through tabular-nums">{fmtVp(base)}</p>
                <p className="font-display text-2xl font-bold tabular-nums">{fmtVp(price)}</p>
                <p className="text-sm text-muted">
                  <Peso vp={price} />
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

interface StoreProps {
  sf: Storefront;
  endsAt: (remainingSeconds: number | null) => number | null;
  resolve: ReturnType<typeof useStoreItems>;
  owned: Set<string>;
}

function Store() {
  const storefront = useStorefront(true);
  const resolve = useStoreItems();
  const ownedLevels = useOwned("skinLevel");
  const owned = useMemo(() => new Set(ownedLevels.data ?? []), [ownedLevels.data]);
  const now = useNow();
  const refreshed = useRef(0);

  const fetchedAt = storefront.dataUpdatedAt;
  const endsAt = (secs: number | null) => (secs === null ? null : fetchedAt + secs * 1000);
  const dailyEnd = storefront.data ? endsAt(storefront.data.daily.remainingSeconds) : null;

  // When the daily shop rotates, fetch the new one (once per rotation).
  useEffect(() => {
    if (dailyEnd !== null && now > dailyEnd + 5_000 && refreshed.current !== dailyEnd) {
      refreshed.current = dailyEnd;
      void storefront.refetch();
    }
  }, [now, dailyEnd, storefront]);

  if (storefront.isPending) return <LoadingBlock label="Loading your store" />;
  if (storefront.isError || !storefront.data) {
    return (
      <ErrorNote
        title="Couldn't load your store."
        action={
          <Button size="sm" onClick={() => void storefront.refetch()}>
            Try again
          </Button>
        }
      >
        Riot didn't return your storefront. Your other pages still work.
      </ErrorNote>
    );
  }

  const props: StoreProps = { sf: storefront.data, endsAt, resolve, owned };
  return (
    <div className="space-y-12">
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
        VP prices come straight from Riot. Peso amounts are <EstimateTag /> based on standard PH VP
        pack prices.
      </p>
      <Daily {...props} />
      <Bundles {...props} />
      <NightMarket {...props} />
    </div>
  );
}

export default function StoreRoute() {
  return (
    <RequireSession title="Store">
      <PageHeader title="Store">
        What's in your shop right now: daily offers, featured bundles and the Night Market.
      </PageHeader>
      <Store />
    </RequireSession>
  );
}
