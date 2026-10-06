import { forwardRef, type ReactNode } from "react";
import type { CatalogSkin, CompetitiveTier, ContentTier } from "@valovertix/assets";
import type { MatchAggregate, MoneyRange, RankSnapshot, SpendingResult } from "@valovertix/calc";
import { OFFICIAL_DOMAIN } from "@/config/app";
import { apiColor, fmtInt, fmtMoney, fmtPct, fmtVp, titleCase } from "@/lib/format";

export type Template = "spending" | "collection" | "rank";
export const SIZES = {
  square: { w: 1080, h: 1080, label: "Square 1080 × 1080" },
  story: { w: 1080, h: 1920, label: "Story 1080 × 1920" },
  wide: { w: 1200, h: 630, label: "Link preview 1200 × 630" },
} as const;
export type SizeKey = keyof typeof SIZES;

export interface CardData {
  riotId: string | null;
  spending: SpendingResult<CatalogSkin> | null;
  money: MoneyRange | null;
  currencyFormat: { locale: string; currency: string };
  totalSkins: number;
  tierById: Map<string, ContentTier>;
  current: RankSnapshot | null;
  peak: { tier: number } | null;
  tiers: Map<number, CompetitiveTier>;
  aggregate: MatchAggregate | null;
  cardArt: string | null;
}

/** Images on the card must be CORS-readable so html-to-image can inline them. */
function Img({
  src,
  alt,
  className,
  style,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (!src) return null;
  return <img src={src} alt={alt} crossOrigin="anonymous" className={className} style={style} />;
}

function Frame({
  size,
  children,
  art,
}: {
  size: SizeKey;
  children: ReactNode;
  art?: string | null;
}) {
  const { w, h } = SIZES[size];
  const pad = size === "wide" ? 56 : 80;
  return (
    <div
      style={{ width: w, height: h, padding: pad }}
      className="relative flex flex-col overflow-hidden bg-bg font-sans text-text"
    >
      {art && (
        <Img src={art} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-bg/40 via-bg/80 to-bg" />
      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
      <div
        className="relative mt-8 flex items-end justify-between gap-6 border-t border-line-strong pt-5"
        style={{ fontSize: 20 }}
      >
        <span className="font-display text-3xl font-bold">
          Valo<span className="text-accent">Vertix</span>
        </span>
        <span className="text-right text-muted">
          {OFFICIAL_DOMAIN} · Not affiliated with Riot Games
        </span>
      </div>
    </div>
  );
}

function Header({ title, riotId }: { title: string; riotId: string | null }) {
  return (
    <div>
      <p className="font-display font-semibold text-muted" style={{ fontSize: 30 }}>
        {title}
      </p>
      {riotId && (
        <p className="font-display font-bold" style={{ fontSize: 56, lineHeight: 1.05 }}>
          {riotId}
        </p>
      )}
    </div>
  );
}

const Estimate = () => (
  <span
    className="border border-warn px-3 py-1 font-display font-semibold text-warn"
    style={{ fontSize: 22 }}
  >
    ESTIMATE
  </span>
);

export const ShareCard = forwardRef<
  HTMLDivElement,
  { template: Template; size: SizeKey; data: CardData }
>(({ template, size, data }, ref) => {
  const tall = size === "story";
  const wide = size === "wide";
  const topSkins = data.spending?.priced.slice(0, tall ? 6 : wide ? 3 : 4) ?? [];

  let body: ReactNode;
  if (template === "spending") {
    body = (
      <>
        <Header title="Estimated skin spend" riotId={data.riotId} />
        {!wide && topSkins.length > 0 && (
          <ul
            className="mt-10 grid min-h-0 flex-1 grid-cols-3 gap-5"
            style={{ maxHeight: tall ? 520 : 200 }}
          >
            {topSkins.slice(0, 3).map((p) => (
              <li
                key={p.owned.skin.uuid}
                className="flex min-h-0 items-center justify-center border border-line-strong bg-surface/80 p-4"
              >
                <Img
                  src={p.owned.skin.icon}
                  alt={p.owned.skin.name}
                  className="max-h-full w-full object-contain"
                />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto pt-10">
          <div className="flex items-center gap-4">
            <Estimate />
            <span className="text-muted" style={{ fontSize: 22 }}>
              Standard PH VP pack prices
            </span>
          </div>
          <p
            className="mt-3 font-display font-bold tabular-nums"
            style={{ fontSize: wide ? 96 : 120, lineHeight: 1 }}
          >
            {data.money ? fmtMoney(data.money, data.currencyFormat) : "No estimate"}
          </p>
          <p className="mt-3 text-muted" style={{ fontSize: 30 }}>
            {data.spending
              ? `${fmtVp(data.spending.totalVp)} across ${data.spending.priced.length} priced skins`
              : ""}
          </p>
          {!wide && data.spending && (
            <ul className="mt-10 space-y-3" style={{ fontSize: 26 }}>
              {data.spending.byTier.slice(0, 5).map((b) => {
                const t = data.tierById.get(b.key);
                return (
                  <li key={b.key} className="flex items-center gap-4">
                    <span
                      className="inline-block size-5"
                      style={{ backgroundColor: apiColor(t?.highlightColor) ?? "#a4abb6" }}
                    />
                    <span className="flex-1">
                      {t?.displayName.replace(/ Edition$/, "") ?? "Unknown"}
                    </span>
                    <span className="tabular-nums">{fmtVp(b.vp)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </>
    );
  } else if (template === "collection") {
    body = (
      <>
        <Header title={`${fmtInt(data.totalSkins)} skins owned`} riotId={data.riotId} />
        <p className="mt-2 text-muted" style={{ fontSize: 24 }}>
          Most valuable in the collection
        </p>
        <ul
          className="mt-8 grid flex-1 gap-5"
          style={{
            gridTemplateColumns: `repeat(${wide ? 3 : 2}, minmax(0, 1fr))`,
            gridAutoRows: "1fr",
          }}
        >
          {topSkins.map((p) => (
            <li
              key={p.owned.skin.uuid}
              className="flex min-h-0 flex-col justify-between border border-line-strong bg-surface/80 p-5"
            >
              <Img
                src={p.owned.skin.icon}
                alt={p.owned.skin.name}
                className="mx-auto min-h-0 w-full flex-1 object-contain"
              />
              <div
                className="mt-3 flex items-baseline justify-between gap-3"
                style={{ fontSize: 22 }}
              >
                <span className="truncate">{p.owned.skin.name}</span>
                <span className="shrink-0 text-muted tabular-nums">{fmtVp(p.vp)}</span>
              </div>
            </li>
          ))}
        </ul>
      </>
    );
  } else {
    const tier = data.current?.tier ? data.tiers.get(data.current.tier) : undefined;
    const peak = data.peak?.tier ? data.tiers.get(data.peak.tier) : undefined;
    body = (
      <>
        <Header title="Competitive" riotId={data.riotId} />
        <div className={wide ? "mt-auto flex items-center gap-12" : "mt-auto"}>
          <div className="flex items-center gap-8">
            <Img
              src={tier?.largeIcon}
              alt=""
              style={{ width: wide ? 180 : 240, height: wide ? 180 : 240 }}
            />
            <div>
              <p
                className="font-display font-bold"
                style={{ fontSize: wide ? 72 : 96, lineHeight: 1 }}
              >
                {tier ? titleCase(tier.tierName) : "Unranked"}
              </p>
              {data.current && tier && (
                <p className="mt-2 text-muted tabular-nums" style={{ fontSize: 32 }}>
                  {data.current.rr} RR
                </p>
              )}
            </div>
          </div>
          <dl
            className={wide ? "space-y-4" : "mt-12 grid grid-cols-2 gap-8"}
            style={{ fontSize: 28 }}
          >
            <div>
              <dt className="text-muted">Peak</dt>
              <dd className="font-display font-bold" style={{ fontSize: 44 }}>
                {peak ? titleCase(peak.tierName) : "None yet"}
              </dd>
            </div>
            {data.aggregate && data.aggregate.games > 0 && (
              <div>
                <dt className="text-muted">Last {data.aggregate.games} matches</dt>
                <dd className="font-display font-bold" style={{ fontSize: 44 }}>
                  {fmtPct(data.aggregate.winRate)} win rate
                </dd>
              </div>
            )}
          </dl>
        </div>
      </>
    );
  }

  return (
    <div ref={ref} data-share-card>
      <Frame size={size} art={template === "rank" ? data.cardArt : null}>
        {body}
      </Frame>
    </div>
  );
});
ShareCard.displayName = "ShareCard";
