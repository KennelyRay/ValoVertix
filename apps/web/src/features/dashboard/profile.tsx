import { isUuid } from "@valovertix/riot";
import { pickLevelBorder, type LevelBorder, type PlayerCard } from "@valovertix/assets";
import { Skeleton } from "@/components/ui/primitives";
import { accountLabel } from "@/features/auth/account-bar";
import { useActiveSession } from "@/features/auth/session-store";
import { useAccountXp, useLoadout, useRanks, useStatic } from "@/features/data";
import { cn } from "@/lib/cn";
import { titleCase } from "@/lib/format";
import { DataFreshness } from "@/features/data-freshness";

/** Everything the profile needs: equipped card and title, level and its border. */
export function useProfile() {
  const loadout = useLoadout();
  const xp = useAccountXp();
  const cards = useStatic("playerCards");
  const titles = useStatic("titles");
  const borders = useStatic("levelBorders");
  const id = (s: string | undefined) => s?.toLowerCase();

  const card = cards.data?.find((c) => id(c.uuid) === id(loadout.data?.PlayerCardID));
  const title = titles.data?.find((t) => id(t.uuid) === id(loadout.data?.PlayerTitleID));
  const level = xp.data?.Level ?? loadout.data?.AccountLevel;
  const hideLevel = loadout.data?.HideAccountLevel ?? false;
  const border = pickLevelBorder(borders.data ?? [], level, loadout.data?.PreferredLevelBorderID);
  const cardId = loadout.data?.PlayerCardID;
  return {
    card,
    /** The equipped card ID from Riot, even when valorant-api.com doesn't list that card yet. */
    cardId: cardId && isUuid(cardId) && !/^0{8}-/.test(cardId) ? cardId.toLowerCase() : undefined,
    title,
    level,
    hideLevel,
    border,
    pending: loadout.isPending || cards.isPending,
    failed: loadout.isError,
  };
}

/** The level number on its border plate, as the game shows it under the player card. */
export function LevelBadge({
  level,
  border,
  className,
}: {
  level: number;
  border: LevelBorder | undefined;
  className?: string;
}) {
  return (
    <div
      className={cn("relative grid h-12 w-[114px] place-items-center", className)}
      title={`Account level ${level}`}
    >
      {border?.levelNumberAppearance ? (
        <img
          src={border.levelNumberAppearance}
          alt=""
          className="absolute inset-0 h-full w-full"
          decoding="async"
        />
      ) : (
        <span aria-hidden className="absolute inset-0 border border-line-strong bg-bg/80" />
      )}
      <span className="relative font-display text-xl font-bold tabular-nums text-text drop-shadow-[0_1px_2px_rgb(0_0_0/0.9)]">
        <span className="sr-only">Level </span>
        {level}
      </span>
    </div>
  );
}

function CardArt({
  card,
  cardId,
  variant,
}: {
  card: PlayerCard | undefined;
  cardId: string | undefined;
  variant: "tall" | "wide";
}) {
  // Fall back to valorant-api.com's standard image address for cards it doesn't list yet.
  const fallback = cardId
    ? `https://media.valorant-api.com/playercards/${cardId}/${variant === "tall" ? "largeart" : "wideart"}.png`
    : undefined;
  const src =
    (variant === "tall" ? (card?.largeArt ?? card?.displayIcon) : card?.wideArt) ?? fallback;
  return src ? (
    <img
      src={src}
      alt=""
      className="absolute inset-0 h-full w-full object-cover"
      decoding="async"
    />
  ) : (
    <div className="absolute inset-0 bg-raised" />
  );
}

const EYEBROW = "text-xs font-semibold uppercase tracking-[0.2em] text-muted";

/**
 * The top of the dashboard, like the client's career header: the equipped card
 * (tall, with its level plate) over a blurred wash of its own art, the title
 * and Riot ID, and the current and peak rank on the right.
 */
export function ProfileHero() {
  const session = useActiveSession()!;
  const p = useProfile();
  const { current, peak, tiers, mmr } = useRanks();
  const showLevel = p.level !== undefined && !p.hideLevel;
  const rankInfo = current?.tier ? tiers.get(current.tier) : undefined;
  const peakInfo = peak?.tier ? tiers.get(peak.tier) : undefined;
  const tierName = (t: number | undefined) =>
    t ? titleCase(tiers.get(t)?.tierName ?? `Tier ${t}`) : "Unranked";
  const caption = p.card
    ? p.card.displayName
    : p.failed
      ? "Couldn't load your card from Riot"
      : p.pending
        ? "Loading card…"
        : p.cardId
          ? "Equipped card"
          : "No card equipped";
  const wideArt =
    p.card?.wideArt ??
    (p.cardId ? `https://media.valorant-api.com/playercards/${p.cardId}/wideart.png` : null);

  return (
    <section aria-label="Account" className="panel relative isolate overflow-hidden p-0">
      {/* The card's wide art as a dim, blurred backdrop (above the panel fill, below the
          content); text sits on the dark side of the scrim. */}
      {wideArt && (
        <img
          src={wideArt}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full scale-110 object-cover opacity-70 blur-[2px]"
          decoding="async"
        />
      )}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-bg from-15% via-bg/80 to-bg/55"
      />
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-accent" />

      <div className="relative grid items-end gap-5 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-6 xl:grid-cols-[auto_minmax(0,1fr)_auto]">
        <figure aria-label="Equipped player card" className="flex items-end gap-4 sm:block">
          <div className="relative aspect-[268/640] w-24 shrink-0 overflow-hidden border border-line-strong bg-raised sm:w-32">
            {p.pending ? (
              <Skeleton className="absolute inset-0" />
            ) : (
              <CardArt card={p.card} cardId={p.cardId} variant="tall" />
            )}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-bg/95 to-transparent" />
            {showLevel && (
              <LevelBadge
                level={p.level!}
                border={p.border}
                className="absolute bottom-2 left-1/2 origin-bottom -translate-x-1/2 scale-[0.7] sm:scale-[0.8]"
              />
            )}
          </div>
          <figcaption className="mt-2 max-w-32 text-xs sm:max-w-32">
            <span className="block text-muted">Equipped card</span>
            <span className="block truncate font-medium text-text">{caption}</span>
          </figcaption>
        </figure>

        <div className="min-w-0 self-center">
          <p className="font-display text-lg font-semibold text-accent">
            {p.title?.titleText ?? (p.pending || p.failed ? " " : "No title equipped")}
          </p>
          <h1 className="display-xl truncate text-4xl sm:text-6xl">{accountLabel(session)}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-sm text-muted">
              {p.level !== undefined ? (
                <>
                  Account level{" "}
                  <span className="font-semibold text-text tabular-nums">{p.level}</span>
                  {p.hideLevel && " (hidden in game)"}
                </>
              ) : p.failed ? (
                "Level unavailable"
              ) : (
                "Loading level…"
              )}
            </p>
            <DataFreshness />
          </div>
        </div>

        <dl className="grid gap-4 border-line sm:col-span-2 sm:grid-cols-2 xl:col-span-1 xl:grid-cols-1 xl:border-l xl:pl-6">
          <div className="flex items-center gap-3">
            {mmr.isPending ? (
              <Skeleton className="size-16" />
            ) : rankInfo?.largeIcon ? (
              <img src={rankInfo.largeIcon} alt="" width={64} height={64} className="size-16" />
            ) : (
              <span aria-hidden className="size-16 border border-dashed border-line-strong" />
            )}
            <div className="min-w-0">
              <dt className={EYEBROW}>Current rank</dt>
              <dd className="font-display text-2xl font-bold uppercase leading-tight">
                {mmr.isPending ? <Skeleton className="h-7 w-32" /> : tierName(current?.tier)}
              </dd>
              {current?.tier ? (
                <dd className="mt-1 w-40">
                  <span className="flex justify-between text-xs text-muted tabular-nums">
                    <span>Rank rating</span>
                    <span className="text-text">{current.rr} RR</span>
                  </span>
                  <span aria-hidden className="mt-1 block h-1 bg-line">
                    <span
                      className="block h-full bg-accent"
                      style={{ width: `${Math.min(100, current.rr)}%` }}
                    />
                  </span>
                </dd>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {peakInfo?.smallIcon ? (
              <img src={peakInfo.smallIcon} alt="" width={40} height={40} className="size-10" />
            ) : (
              <span aria-hidden className="size-10" />
            )}
            <div>
              <dt className={EYEBROW}>Peak rank</dt>
              <dd className="font-display text-xl font-bold uppercase leading-tight">
                {mmr.isPending ? <Skeleton className="h-6 w-28" /> : tierName(peak?.tier)}
              </dd>
            </div>
          </div>
        </dl>
      </div>
    </section>
  );
}
