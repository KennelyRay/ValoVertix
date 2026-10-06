import { useState } from "react";
import type { CatalogSkin } from "@valovertix/assets";
import { vpToMoneyRange, type OfferIndex, type OwnedSkin, type PricedSkin } from "@valovertix/calc";
import { CURRENCY } from "@valovertix/riot";
import { Dialog, EstimateTag } from "@/components/ui/primitives";
import { currencyConfig } from "@/features/data";
import { EstimateInfo } from "@/features/spending/estimate-notes";
import { cn } from "@/lib/cn";
import { fmtMoney, fmtVp } from "@/lib/format";

type Price = Pick<PricedSkin, "vp" | "source"> | undefined;

export function SkinDrawer({
  owned,
  offers,
  price,
  tierName,
  onClose,
}: {
  owned: OwnedSkin<CatalogSkin> | null;
  /** Riot's price list, for Radianite upgrade costs. Null when unavailable. */
  offers: OfferIndex | null;
  /** The skin's price as used in the spending estimate. */
  price: Price;
  tierName: string | undefined;
  onClose: () => void;
}) {
  return (
    <Dialog side open={Boolean(owned)} onClose={onClose} title={owned?.skin.name ?? ""}>
      {owned && (
        <SkinDetail
          key={owned.skin.uuid}
          owned={owned}
          offers={offers}
          price={price}
          tierName={tierName}
        />
      )}
    </Dialog>
  );
}

function SkinDetail({
  owned,
  offers,
  price,
  tierName,
}: {
  owned: OwnedSkin<CatalogSkin>;
  offers: OfferIndex | null;
  price: Price;
  tierName: string | undefined;
}) {
  const { skin } = owned;
  const ownedLevels = new Set(owned.levelIds);
  const ownedChromas = new Set([skin.chromas[0]?.uuid, ...owned.chromaIds]);
  const firstVideo =
    skin.levels.find((l) => l.video)?.video ?? skin.chromas.find((c) => c.video)?.video ?? null;
  const [video, setVideo] = useState<string | null>(firstVideo);
  const [preview, setPreview] = useState(skin.chromas[0]?.fullRender ?? skin.icon);

  const currency = currencyConfig();
  const vp = price?.vp;
  const radianite = (id: string) => offers?.get(id)?.[CURRENCY.radianite];

  return (
    <div className="space-y-6">
      <div className="flex min-h-36 items-center justify-center bg-bg p-4">
        {preview && (
          <img
            src={preview}
            alt={skin.name}
            className="max-h-40 w-auto object-contain"
            decoding="async"
          />
        )}
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted">Weapon</dt>
          <dd className="font-medium">{skin.weaponName}</dd>
        </div>
        <div>
          <dt className="text-muted">Tier</dt>
          <dd className="font-medium">{tierName ?? "No tier"}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 text-muted">
            {price?.source === "tier" ? "Standard tier price" : "Store price"} <EstimateTag />
          </dt>
          <dd className="font-display text-xl font-bold">
            {vp ? fmtVp(vp) : skin.isContractReward ? "Battle pass or contract" : "No store offer"}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 text-muted">
            In pesos <EstimateTag />
          </dt>
          <dd className="font-display text-xl font-bold">
            {vp ? fmtMoney(vpToMoneyRange(vp, currency.rate), currency.format) : "Not counted"}
          </dd>
        </div>
      </dl>
      <EstimateInfo />

      {skin.levels.length > 1 && (
        <section aria-labelledby="levels-title">
          <h3 id="levels-title" className="text-lg">
            Levels
          </h3>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {skin.levels.map((l, i) => {
              const has = ownedLevels.has(l.uuid);
              const cost = i > 0 ? radianite(l.uuid) : undefined;
              return (
                <li key={l.uuid} className="flex items-center gap-3 py-2 text-sm">
                  <span
                    className={cn("w-16 shrink-0 font-medium", has ? "text-text" : "text-faint")}
                  >
                    {has ? "Owned" : "Not owned"}
                  </span>
                  <span className="min-w-0 flex-1">
                    Level {i + 1}
                    {l.upgrade && <span className="text-muted"> · {l.upgrade}</span>}
                  </span>
                  {cost ? (
                    <span className="shrink-0 text-muted tabular-nums">{cost} RP</span>
                  ) : null}
                  {l.video && (
                    <button
                      type="button"
                      onClick={() => setVideo(l.video)}
                      aria-pressed={video === l.video}
                      className="inline-flex min-h-11 shrink-0 items-center px-2 text-muted underline underline-offset-4 hover:text-text"
                    >
                      Preview<span className="sr-only"> level {i + 1}</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {skin.chromas.length > 1 && (
        <section aria-labelledby="chromas-title">
          <h3 id="chromas-title" className="text-lg">
            Variants
          </h3>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {skin.chromas.map((c, i) => {
              const has = ownedChromas.has(c.uuid);
              const cost = i > 0 ? radianite(c.uuid) : undefined;
              return (
                <li key={c.uuid}>
                  <button
                    type="button"
                    onClick={() => {
                      setPreview(c.fullRender ?? c.icon ?? preview);
                      if (c.video) setVideo(c.video);
                    }}
                    className={cn(
                      "flex min-h-11 w-full flex-col items-center gap-1 border p-2 text-xs",
                      has ? "border-line-strong" : "border-line border-dashed text-muted",
                    )}
                  >
                    {c.swatch ? (
                      <img
                        src={c.swatch}
                        alt=""
                        width={32}
                        height={32}
                        className="size-8"
                        loading="lazy"
                      />
                    ) : (
                      <span className="size-8" />
                    )}
                    <span className="sr-only">{c.name}, </span>
                    <span>{i === 0 ? "Base" : has ? "Owned" : "Not owned"}</span>
                    {cost ? <span className="tabular-nums text-muted">{cost} RP</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {video && (
        <section aria-labelledby="video-title">
          <h3 id="video-title" className="text-lg">
            Video preview
          </h3>
          <video
            key={video}
            src={video}
            controls
            muted
            playsInline
            preload="none"
            poster={preview ?? undefined}
            className="mt-2 aspect-video w-full bg-bg"
          >
            <track kind="captions" />
          </video>
        </section>
      )}
    </div>
  );
}
