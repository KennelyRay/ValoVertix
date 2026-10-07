import { forwardRef, type CSSProperties, type ReactNode } from "react";
import type { CatalogSkin, CompetitiveTier, ContentTier, LevelBorder } from "@valovertix/assets";
import type { MatchSummary, MoneyRange, RankSnapshot, SpendingResult } from "@valovertix/calc";
import { OFFICIAL_DOMAIN } from "@/config/app";
import { apiColor, fmtDec, fmtInt, fmtMoney, fmtPct, fmtVp, titleCase } from "@/lib/format";

export type Template = "locker" | "collection" | "spending" | "profile" | "rank" | "loadout";
export const SIZES = {
  square: { w: 1080, h: 1080, label: "Square 1080 × 1080" },
  story: { w: 1080, h: 1920, label: "Story 1080 × 1920" },
  wide: { w: 1200, h: 630, label: "Link preview 1200 × 630" },
} as const;
export type SizeKey = keyof typeof SIZES;

/** How many skins each template shows at each size. */
export const SKIN_SLOTS: Record<Template, Record<SizeKey, number>> = {
  locker: { square: 9, story: 15, wide: 8 },
  collection: { square: 16, story: 20, wide: 10 },
  spending: { square: 3, story: 4, wide: 3 },
  profile: { square: 0, story: 0, wide: 0 },
  rank: { square: 0, story: 0, wide: 0 },
  loadout: { square: 0, story: 0, wide: 0 },
};

/** Equipped weapons shown on the loadout card at each size. */
export const LOADOUT_SLOTS: Record<SizeKey, number> = { square: 12, story: 21, wide: 8 };

export interface CardGun {
  key: string;
  weapon: string;
  skin: string;
  image: string | null;
  color: string | undefined;
}

export interface CardSkin {
  skin: CatalogSkin;
  vp: number | undefined;
}

export interface CardData {
  riotId: string | null;
  title: string | null;
  level: number | null;
  levelBorder: LevelBorder | undefined;
  cardArtTall: string | null;
  background: string | null;
  skins: CardSkin[];
  totalSkins: number;
  tierCounts: { tier: ContentTier; count: number }[];
  tierById: Map<string, ContentTier>;
  spending: SpendingResult<CatalogSkin> | null;
  money: MoneyRange | null;
  currencyFormat: { locale: string; currency: string };
  tierPriced: boolean;
  current: RankSnapshot | null;
  peak: { tier: number } | null;
  tiers: Map<number, CompetitiveTier>;
  recent: MatchSummary[];
  /** Equipped skins that fit the card (standard skins left out), in in-game order. */
  loadout: CardGun[];
  /** All equipped non-standard skins, including ones that didn't fit. */
  loadoutCount: number;
  /** Style options. */
  accent: string;
  headline: string | null;
  showPrices: boolean;
  tilt: boolean;
  showTierBar: boolean;
  /** Collection template: this card's place in the set, and the paid-skin total. */
  page: { index: number; total: number };
  paidCount: number;
}

export const ACCENTS = {
  red: { label: "Red", color: "#ff4d5e" },
  teal: { label: "Teal", color: "#3fd0c9" },
  gold: { label: "Gold", color: "#e7c46a" },
  violet: { label: "Violet", color: "#a98bff" },
  white: { label: "White", color: "#ece8e1" },
} as const;
export type AccentKey = keyof typeof ACCENTS;

const BRAND_RED = "#ff4d5e";
const RED = "var(--card-accent)";
const LINE = "rgba(74,82,96,0.85)";
const tierName = (t: ContentTier | undefined) =>
  t?.displayName.replace(/ Edition$/, "") ?? "No tier";
const rankName = (tiers: Map<number, CompetitiveTier>, tier: number | undefined | null) =>
  tier ? titleCase(tiers.get(tier)?.tierName ?? `Tier ${tier}`) : "Unranked";

/** Images must be CORS-readable so html-to-image can inline them. */
function Img({
  src,
  className,
  style,
}: {
  src: string | null | undefined;
  className?: string;
  style?: CSSProperties;
}) {
  if (!src) return null;
  return <img src={src} alt="" crossOrigin="anonymous" className={className} style={style} />;
}

/** HUD corner brackets as real elements (pseudo-elements don't always survive export). */
function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const inset = 28;
  const edge = "3px solid rgba(236,232,225,0.7)";
  const style: CSSProperties = { position: "absolute", width: 40, height: 40 };
  if (pos[0] === "t") Object.assign(style, { top: inset, borderTop: edge });
  else Object.assign(style, { bottom: inset, borderBottom: edge });
  if (pos[1] === "l") Object.assign(style, { left: inset, borderLeft: edge });
  else Object.assign(style, { right: inset, borderRight: edge });
  return <div aria-hidden style={style} />;
}

function EstimateTag() {
  return (
    <span
      className="font-display font-semibold"
      style={{
        border: "2px solid #e7c46a",
        color: "#e7c46a",
        padding: "4px 12px",
        fontSize: 22,
        letterSpacing: "0.06em",
      }}
    >
      ESTIMATE
    </span>
  );
}

function Label({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <p
      className="flex items-center font-display font-semibold uppercase text-muted"
      style={{ gap: 14, fontSize: size, letterSpacing: "0.1em" }}
    >
      <span style={{ display: "inline-block", width: 36, height: 4, background: RED }} />
      {children}
    </p>
  );
}

function Frame({
  size,
  data,
  label,
  money,
  children,
}: {
  size: SizeKey;
  data: CardData;
  label: string;
  money?: boolean;
  children: ReactNode;
}) {
  const { w, h } = SIZES[size];
  const wide = size === "wide";
  const pad = wide ? 52 : 76;
  return (
    <div
      style={{ width: w, height: h, ["--card-accent" as string]: data.accent }}
      className="relative flex flex-col overflow-hidden bg-bg font-sans text-text"
    >
      <Img
        src={data.background}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: 0.45, filter: "saturate(1.15)" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(14,17,23,0.55) 0%, rgba(14,17,23,0.82) 45%, rgba(14,17,23,0.96) 100%)",
        }}
      />
      {/* HUD grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(236,232,225,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(236,232,225,0.05) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />
      {/* Red slashes, top right */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: pad - 6,
          right: -60,
          width: 340,
          height: 16,
          background: RED,
          transform: "skewX(-35deg)",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: pad + 20,
          right: -60,
          width: 200,
          height: 6,
          background: RED,
          opacity: 0.6,
          transform: "skewX(-35deg)",
        }}
      />
      <Corner pos="tl" />
      <Corner pos="tr" />
      <Corner pos="bl" />
      <Corner pos="br" />

      <div className="relative flex min-h-0 flex-1 flex-col" style={{ padding: pad }}>
        <div className="flex items-center justify-between" style={{ gap: 24 }}>
          <div className="flex items-center" style={{ gap: 16 }}>
            <img src="/brand/mark.png" alt="" style={{ height: wide ? 44 : 58, width: "auto" }} />
            <span
              className="font-display font-bold italic"
              style={{ fontSize: wide ? 34 : 44, lineHeight: 1 }}
            >
              Valo<span style={{ color: BRAND_RED }}>Vertix</span>
            </span>
          </div>
          <span
            className="font-display font-bold uppercase"
            style={{
              fontSize: wide ? 22 : 26,
              letterSpacing: "0.16em",
              marginRight: wide ? 200 : 260,
            }}
          >
            {label}
          </span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col" style={{ marginTop: wide ? 26 : 48 }}>
          {children}
        </div>

        <div
          className="flex items-center justify-between text-muted"
          style={{
            marginTop: wide ? 20 : 28,
            paddingTop: 16,
            borderTop: `2px solid ${LINE}`,
            fontSize: wide ? 17 : 20,
            gap: 24,
          }}
        >
          <span className="font-semibold text-text">{OFFICIAL_DOMAIN}</span>
          <span>
            {money ? "Estimate from PH VP pack prices · " : ""}Not affiliated with Riot Games
          </span>
        </div>
      </div>
    </div>
  );
}

function Heading({ data, fallback, size }: { data: CardData; fallback: string; size: SizeKey }) {
  return (
    <div className="min-w-0">
      {data.title && (
        <p
          className="font-display font-semibold text-muted"
          style={{ fontSize: size === "wide" ? 22 : 30 }}
        >
          {data.title}
        </p>
      )}
      <p
        className="display-xl truncate"
        style={{ fontSize: size === "wide" ? 60 : size === "story" ? 100 : 84 }}
      >
        {data.headline ?? data.riotId ?? fallback}
      </p>
    </div>
  );
}

function TierBar({ data, size }: { data: CardData; size: SizeKey }) {
  const total = data.tierCounts.reduce((s, t) => s + t.count, 0) || 1;
  return (
    <div>
      <div className="flex" style={{ height: size === "wide" ? 10 : 16, gap: 3 }}>
        {data.tierCounts.map((t) => (
          <div
            key={t.tier.uuid}
            style={{ flex: t.count / total, background: apiColor(t.tier.highlightColor) }}
          />
        ))}
      </div>
      <div
        className="flex flex-wrap text-muted"
        style={{ marginTop: 10, gap: "6px 24px", fontSize: size === "wide" ? 17 : 22 }}
      >
        {data.tierCounts.map((t) => (
          <span key={t.tier.uuid} className="flex items-center" style={{ gap: 8 }}>
            <span style={{ width: 14, height: 14, background: apiColor(t.tier.highlightColor) }} />
            {tierName(t.tier)} <span className="font-semibold text-text">{fmtInt(t.count)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function SkinTile({ item, data, compact }: { item: CardSkin; data: CardData; compact?: boolean }) {
  const tier = item.skin.tierId ? data.tierById.get(item.skin.tierId) : undefined;
  return (
    <div
      className="relative flex min-h-0 flex-col justify-between overflow-hidden"
      style={{
        background: "rgba(22,27,34,0.85)",
        border: `2px solid ${LINE}`,
        padding: compact ? 12 : 18,
      }}
    >
      <Img
        src={item.skin.icon}
        className="mx-auto min-h-0 w-full flex-1 object-contain"
        style={{
          transform: data.tilt ? "rotate(-6deg)" : undefined,
          filter: "drop-shadow(0 12px 14px rgba(0,0,0,0.55))",
        }}
      />
      <div style={{ marginTop: 8 }}>
        <p className="truncate font-semibold" style={{ fontSize: compact ? 16 : 21 }}>
          {item.skin.name}
        </p>
        <p
          className="flex justify-between text-muted"
          style={{ fontSize: compact ? 14 : 17, gap: 8 }}
        >
          <span className="truncate">{tierName(tier)}</span>
          {data.showPrices && item.vp !== undefined && (
            <span className="shrink-0 tabular-nums">{fmtVp(item.vp)}</span>
          )}
        </p>
      </div>
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 5,
          background: apiColor(tier?.highlightColor) ?? "#4a5260",
        }}
      />
    </div>
  );
}

function Locker({ size, data }: { size: SizeKey; data: CardData }) {
  const wide = size === "wide";
  return (
    <Frame size={size} data={data} label="Locker">
      <div className="flex items-end justify-between" style={{ gap: 24 }}>
        <Heading data={data} fallback="My locker" size={size} />
        <div className="shrink-0 text-right">
          <p className="display-xl tabular-nums" style={{ fontSize: wide ? 64 : 96 }}>
            {fmtInt(data.totalSkins)}
          </p>
          <p
            className="font-display font-semibold uppercase text-muted"
            style={{ fontSize: wide ? 16 : 22, letterSpacing: "0.1em" }}
          >
            Skins owned
          </p>
        </div>
      </div>
      {data.showTierBar && (
        <div style={{ marginTop: wide ? 14 : 32 }}>
          <TierBar data={data} size={size} />
        </div>
      )}
      <div
        className="grid min-h-0 flex-1"
        style={{
          marginTop: wide ? 16 : 36,
          gap: wide ? 10 : 16,
          gridTemplateColumns: `repeat(${wide ? 4 : 3}, minmax(0, 1fr))`,
          gridAutoRows: "1fr",
        }}
      >
        {data.skins.map((s) => (
          <SkinTile key={s.skin.uuid} item={s} data={data} compact={wide} />
        ))}
      </div>
    </Frame>
  );
}

/** Every paid skin, one page of the set per card. */
function Collection({ size, data }: { size: SizeKey; data: CardData }) {
  const wide = size === "wide";
  const story = size === "story";
  const multi = data.page.total > 1;
  return (
    <Frame
      size={size}
      data={data}
      label={multi ? `Collection ${data.page.index + 1}/${data.page.total}` : "Collection"}
    >
      <div className="flex items-end justify-between" style={{ gap: 24 }}>
        <Heading data={data} fallback="My collection" size={size} />
        <div className="shrink-0 text-right">
          <p className="display-xl tabular-nums" style={{ fontSize: wide ? 60 : 92 }}>
            {fmtInt(data.paidCount)}
          </p>
          <p
            className="font-display font-semibold uppercase text-muted"
            style={{ fontSize: wide ? 15 : 21, letterSpacing: "0.1em" }}
          >
            Paid skins
          </p>
        </div>
      </div>
      {data.showTierBar && !wide && (
        <div style={{ marginTop: 26 }}>
          <TierBar data={data} size={size} />
        </div>
      )}
      <div
        className="grid min-h-0 flex-1"
        style={{
          marginTop: wide ? 16 : 30,
          gap: wide ? 10 : 14,
          gridTemplateColumns: `repeat(${wide ? 5 : 4}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${wide ? 2 : story ? 5 : 4}, minmax(0, 1fr))`,
        }}
      >
        {data.skins.map((s) => (
          <SkinTile key={s.skin.uuid} item={s} data={data} compact />
        ))}
      </div>
      {multi && (
        <p
          className="font-display font-semibold uppercase text-muted"
          style={{ marginTop: wide ? 10 : 18, fontSize: wide ? 15 : 20, letterSpacing: "0.12em" }}
        >
          Card {data.page.index + 1} of {data.page.total} · skins{" "}
          {fmtInt(data.page.index * SKIN_SLOTS.collection[size] + 1)} to{" "}
          {fmtInt(Math.min(data.paidCount, (data.page.index + 1) * SKIN_SLOTS.collection[size]))}
        </p>
      )}
    </Frame>
  );
}

function Spending({ size, data }: { size: SizeKey; data: CardData }) {
  const sp = data.spending;
  const wide = size === "wide";
  const max = Math.max(1, ...(sp?.byTier.map((b) => b.vp) ?? [1]));
  return (
    <Frame size={size} data={data} label="Spending" money>
      <Heading data={data} fallback="My skin spend" size={size} />
      <div style={{ marginTop: wide ? 14 : 40 }}>
        <div className="flex items-center" style={{ gap: 16 }}>
          <Label size={wide ? 18 : 24}>Estimated value</Label>
          <EstimateTag />
        </div>
        <p
          className="display-xl whitespace-nowrap tabular-nums"
          style={{ fontSize: wide ? 80 : 96, marginTop: 12 }}
        >
          {data.money ? fmtMoney(data.money, data.currencyFormat) : "No estimate"}
        </p>
        <p className="text-muted" style={{ fontSize: wide ? 20 : 28, marginTop: 8 }}>
          {sp ? `${fmtVp(sp.totalVp)} across ${fmtInt(sp.priced.length)} skins` : ""}
          {data.tierPriced ? " · tier list prices" : ""}
        </p>
      </div>
      {!wide && sp && (
        <div style={{ marginTop: 40, display: "grid", gap: 16 }}>
          {sp.byTier.slice(0, 5).map((b) => {
            const t = data.tierById.get(b.key);
            return (
              <div key={b.key}>
                <div className="flex justify-between" style={{ fontSize: 24 }}>
                  <span>{tierName(t)}</span>
                  <span className="tabular-nums text-muted">{fmtVp(b.vp)}</span>
                </div>
                <div style={{ height: 10, background: "rgba(43,50,61,0.9)", marginTop: 8 }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${(b.vp / max) * 100}%`,
                      background: apiColor(t?.highlightColor),
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div
        className="grid min-h-0 flex-1"
        style={{
          marginTop: wide ? 16 : 40,
          gap: wide ? 10 : 16,
          // Story is tall and narrow: two columns keep the art large.
          gridTemplateColumns: `repeat(${size === "story" ? 2 : Math.max(1, data.skins.length)}, minmax(0, 1fr))`,
          gridAutoRows: "1fr",
        }}
      >
        {data.skins.map((s) => (
          <SkinTile key={s.skin.uuid} item={s} data={data} compact={wide} />
        ))}
      </div>
    </Frame>
  );
}

function Stat({
  label,
  value,
  sub,
  size,
  valueSize,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  size: SizeKey;
  /** Overrides the value font size where columns are narrow. */
  valueSize?: number;
}) {
  const wide = size === "wide";
  return (
    <div
      className="min-w-0"
      style={{ borderLeft: `4px solid ${LINE}`, paddingLeft: wide ? 14 : 18 }}
    >
      <p
        className="font-display font-semibold uppercase text-muted"
        style={{ fontSize: wide ? 15 : 20, letterSpacing: "0.1em" }}
      >
        {label}
      </p>
      <div
        className="display-xl whitespace-nowrap"
        style={{ fontSize: valueSize ?? (wide ? 34 : 50), marginTop: 6 }}
      >
        {value}
      </div>
      {sub && (
        <p className="text-muted" style={{ fontSize: wide ? 15 : 20, marginTop: 4 }}>
          {sub}
        </p>
      )}
    </div>
  );
}

const winRate = (recent: MatchSummary[]) =>
  recent.length ? recent.filter((m) => m.result === "win").length / recent.length : null;

function LevelPlate({ data, scale = 1 }: { data: CardData; scale?: number }) {
  if (data.level === null) return null;
  return (
    <div
      className="absolute grid place-items-center"
      style={{
        left: "50%",
        bottom: 22 * scale,
        transform: "translateX(-50%)",
        width: 152 * scale,
        height: 64 * scale,
      }}
    >
      {data.levelBorder?.levelNumberAppearance ? (
        <Img
          src={data.levelBorder.levelNumberAppearance}
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ border: `2px solid ${LINE}`, background: "rgba(14,17,23,0.8)" }}
        />
      )}
      <span className="relative font-display font-bold" style={{ fontSize: 30 * scale }}>
        {data.level}
      </span>
    </div>
  );
}

function Profile({ size, data }: { size: SizeKey; data: CardData }) {
  const wide = size === "wide";
  const story = size === "story";
  const wr = winRate(data.recent);
  const rankIcon = data.current?.tier ? data.tiers.get(data.current.tier)?.largeIcon : null;
  const cardW = wide ? 168 : story ? 380 : 290;
  // Two stat columns sit beside the card, so values use a smaller size than elsewhere.
  const vs = wide ? 28 : story ? 52 : 38;
  return (
    <Frame size={size} data={data} label="Profile" money={!wide && Boolean(data.money)}>
      <div
        className={story ? "flex flex-col" : "flex"}
        style={{ gap: wide ? 30 : 48, flex: 1, minHeight: 0 }}
      >
        <div
          className="relative shrink-0 overflow-hidden"
          style={{
            width: cardW,
            aspectRatio: "268 / 640",
            alignSelf: story ? "center" : "flex-start",
            border: `3px solid ${LINE}`,
          }}
        >
          <Img src={data.cardArtTall} className="absolute inset-0 h-full w-full object-cover" />
          <div
            className="absolute inset-x-0 bottom-0"
            style={{
              height: "35%",
              background: "linear-gradient(to top, rgba(14,17,23,0.95), transparent)",
            }}
          />
          <LevelPlate data={data} scale={wide ? 0.7 : 1} />
        </div>
        <div
          className="flex min-w-0 flex-1 flex-col"
          style={{ gap: wide ? 18 : 40, justifyContent: "center" }}
        >
          <Heading data={data} fallback="My profile" size={size} />
          <div
            className="grid"
            style={{
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: wide ? "16px 22px" : "30px 36px",
            }}
          >
            <Stat
              size={size}
              valueSize={vs}
              label="Current rank"
              value={
                <span className="flex items-center" style={{ gap: 12 }}>
                  <Img
                    src={rankIcon}
                    style={{
                      width: wide ? 30 : story ? 52 : 40,
                      height: wide ? 30 : story ? 52 : 40,
                    }}
                  />
                  {rankName(data.tiers, data.current?.tier)}
                </span>
              }
              sub={data.current?.tier ? `${data.current.rr} RR` : undefined}
            />
            <Stat
              size={size}
              valueSize={vs}
              label="Peak rank"
              value={rankName(data.tiers, data.peak?.tier)}
            />
            <Stat size={size} valueSize={vs} label="Skins owned" value={fmtInt(data.totalSkins)} />
            <Stat
              size={size}
              valueSize={vs}
              label="Win rate"
              value={wr === null ? "No matches" : fmtPct(wr)}
              sub={wr === null ? undefined : `Last ${data.recent.length} matches`}
            />
            {!wide && data.money && (
              <div style={{ gridColumn: "span 2" }}>
                <Stat
                  size={size}
                  valueSize={vs}
                  label="Collection value · estimate"
                  value={fmtMoney(data.money, data.currencyFormat)}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </Frame>
  );
}

function Rank({ size, data }: { size: SizeKey; data: CardData }) {
  const wide = size === "wide";
  const story = size === "story";
  const tier = data.current?.tier ? data.tiers.get(data.current.tier) : undefined;
  const wr = winRate(data.recent);
  const k = data.recent.reduce((s, m) => s + m.kills, 0);
  const d = data.recent.reduce((s, m) => s + m.deaths, 0);
  const a = data.recent.reduce((s, m) => s + m.assists, 0);
  const iconSize = wide ? 200 : story ? 420 : 290;
  return (
    <Frame size={size} data={data} label="Rank">
      <Heading data={data} fallback="My rank" size={size} />
      <div
        className={story ? "flex flex-col items-start" : "flex items-center"}
        style={{ gap: wide ? 34 : 48, marginTop: wide ? 10 : 40, flex: 1, minHeight: 0 }}
      >
        <Img
          src={tier?.largeIcon}
          style={{
            width: iconSize,
            height: iconSize,
            filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.6))",
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="display-xl" style={{ fontSize: wide ? 70 : 112 }}>
            {rankName(data.tiers, data.current?.tier)}
          </p>
          {data.current?.tier ? (
            <div style={{ marginTop: 16, maxWidth: 560 }}>
              <div className="flex justify-between text-muted" style={{ fontSize: wide ? 20 : 24 }}>
                <span>Rank rating</span>
                <span className="font-semibold text-text tabular-nums">
                  {data.current.rr} / 100 RR
                </span>
              </div>
              <div
                style={{ height: wide ? 10 : 14, background: "rgba(43,50,61,0.9)", marginTop: 10 }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, data.current.rr)}%`,
                    background: RED,
                  }}
                />
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap" style={{ gap: "16px 40px", marginTop: wide ? 20 : 32 }}>
            <Stat size={size} label="Peak" value={rankName(data.tiers, data.peak?.tier)} />
            {wr !== null && (
              <Stat
                size={size}
                label="Win rate"
                value={fmtPct(wr)}
                sub={`Last ${data.recent.length}`}
              />
            )}
            {data.recent.length > 0 && (
              <Stat size={size} label="KDA" value={fmtDec((k + a) / Math.max(1, d), 2)} />
            )}
          </div>
        </div>
      </div>
      {data.recent.length > 0 && (
        <div style={{ marginTop: wide ? 16 : 28 }}>
          <Label size={wide ? 16 : 20}>Last {data.recent.length} matches</Label>
          <div className="flex" style={{ gap: 10, marginTop: 12 }}>
            {data.recent.map((m) => {
              const color =
                m.result === "win" ? "#5fd3a0" : m.result === "loss" ? "#ff7a85" : "#a4abb6";
              return (
                <div
                  key={m.matchId}
                  className="grid place-items-center font-display font-bold"
                  style={{
                    width: wide ? 44 : 64,
                    height: wide ? 44 : 64,
                    fontSize: wide ? 20 : 26,
                    color,
                    border: `2px solid ${color}`,
                    background: `${color}26`,
                  }}
                >
                  {m.result === "win" ? "W" : m.result === "loss" ? "L" : "D"}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Frame>
  );
}

function Loadout({ size, data }: { size: SizeKey; data: CardData }) {
  const wide = size === "wide";
  const guns = data.loadout.slice(0, LOADOUT_SLOTS[size]);
  return (
    <Frame size={size} data={data} label="Loadout">
      <div className="flex items-end justify-between" style={{ gap: 24 }}>
        <Heading data={data} fallback="My loadout" size={size} />
        <div className="shrink-0 text-right">
          <p className="display-xl tabular-nums" style={{ fontSize: wide ? 64 : 96 }}>
            {fmtInt(data.loadoutCount)}
          </p>
          <p
            className="font-display font-semibold uppercase text-muted"
            style={{ fontSize: wide ? 16 : 22, letterSpacing: "0.1em" }}
          >
            Skins equipped
          </p>
        </div>
      </div>
      <div
        className="grid min-h-0 flex-1"
        style={{
          marginTop: wide ? 18 : 40,
          gap: wide ? 10 : 16,
          gridTemplateColumns: `repeat(${size === "story" ? 3 : 4}, minmax(0, 1fr))`,
          gridAutoRows: "1fr",
        }}
      >
        {guns.map((g) => (
          <div
            key={g.key}
            className="relative flex min-h-0 flex-col overflow-hidden"
            style={{
              background: "rgba(22,27,34,0.85)",
              border: `2px solid ${LINE}`,
              padding: wide ? 10 : 16,
            }}
          >
            <p
              className="font-display font-semibold uppercase text-muted"
              style={{ fontSize: wide ? 13 : 17, letterSpacing: "0.1em" }}
            >
              {g.weapon}
            </p>
            <Img
              src={g.image}
              className="mx-auto min-h-0 w-full flex-1 object-contain"
              style={{ filter: "drop-shadow(0 10px 12px rgba(0,0,0,0.55))", padding: "6px 0" }}
            />
            <p className="truncate font-semibold" style={{ fontSize: wide ? 15 : 20 }}>
              {g.skin}
            </p>
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 5,
                background: g.color ?? "#4a5260",
              }}
            />
          </div>
        ))}
      </div>
    </Frame>
  );
}

export const ShareCard = forwardRef<
  HTMLDivElement,
  { template: Template; size: SizeKey; data: CardData }
>(({ template, size, data }, ref) => (
  <div ref={ref} data-share-card>
    {template === "locker" && <Locker size={size} data={data} />}
    {template === "collection" && <Collection size={size} data={data} />}
    {template === "spending" && <Spending size={size} data={data} />}
    {template === "profile" && <Profile size={size} data={data} />}
    {template === "rank" && <Rank size={size} data={data} />}
    {template === "loadout" && <Loadout size={size} data={data} />}
  </div>
));
ShareCard.displayName = "ShareCard";
