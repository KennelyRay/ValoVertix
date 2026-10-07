import { isUuid } from "@valovertix/riot";
import { pickLevelBorder, type LevelBorder, type PlayerCard } from "@valovertix/assets";
import { RankBadge } from "@/components/shared";
import { Skeleton } from "@/components/ui/primitives";
import { accountLabel } from "@/features/auth/account-bar";
import { useActiveSession } from "@/features/auth/session-store";
import { useAccountXp, useLoadout, useRanks, useStatic } from "@/features/data";
import { cn } from "@/lib/cn";
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

/**
 * The equipped player card, shown like the in-game career screen: full-height
 * card art with the level plate at the bottom. A wide banner on small screens.
 */
export function PlayerCardShowcase() {
  const p = useProfile();
  const showLevel = p.level !== undefined && !p.hideLevel;
  const caption = p.card
    ? p.card.displayName
    : p.failed
      ? "Couldn't load your card from Riot"
      : p.pending
        ? "Loading card…"
        : p.cardId
          ? "Equipped card"
          : "No card equipped";

  return (
    <figure aria-label="Equipped player card" className="panel overflow-hidden p-0">
      {/* Tall card (desktop) */}
      <div className="relative hidden aspect-[268/640] lg:block">
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
            className="absolute bottom-5 left-1/2 -translate-x-1/2"
          />
        )}
      </div>
      {/* Wide banner (phones and tablets) */}
      <div className="relative aspect-[452/128] lg:hidden">
        {p.pending ? (
          <Skeleton className="absolute inset-0" />
        ) : (
          <CardArt card={p.card} cardId={p.cardId} variant="wide" />
        )}
        {showLevel && (
          <LevelBadge level={p.level!} border={p.border} className="absolute bottom-2 right-2" />
        )}
      </div>
      <figcaption className="px-4 py-3 text-sm">
        <span className="text-muted">Equipped card</span>
        <span className="block truncate font-medium">{caption}</span>
      </figcaption>
    </figure>
  );
}

/** Riot ID, equipped title, level and ranks. */
export function IdentityHeader() {
  const session = useActiveSession()!;
  const p = useProfile();
  const { current, peak, tiers, mmr } = useRanks();

  return (
    <section aria-label="Account" className="flex flex-wrap items-end justify-between gap-6">
      <div className="min-w-0">
        <p className="font-display text-lg font-semibold text-text">
          {p.title?.titleText ?? (p.pending || p.failed ? " " : "No title equipped")}
        </p>
        <h1 className="truncate text-4xl sm:text-6xl">{accountLabel(session)}</h1>
        <p className="mt-1 text-muted">
          {p.level !== undefined ? (
            <>
              Account level <span className="text-text tabular-nums">{p.level}</span>
              {p.hideLevel && " (hidden in game)"}
            </>
          ) : p.failed ? (
            "Level unavailable"
          ) : (
            "Loading level…"
          )}
        </p>
        <DataFreshness className="mt-2" />
      </div>
      <dl className="flex flex-wrap gap-x-8 gap-y-4">
        <div>
          <dt className="mb-1 text-sm text-muted">Current rank</dt>
          <dd>
            {mmr.isPending ? (
              <Skeleton className="h-10 w-36" />
            ) : (
              <RankBadge tier={current?.tier} rr={current?.rr} tiers={tiers} />
            )}
          </dd>
        </div>
        <div>
          <dt className="mb-1 text-sm text-muted">Peak rank</dt>
          <dd>
            {mmr.isPending ? (
              <Skeleton className="h-10 w-36" />
            ) : (
              <RankBadge tier={peak?.tier} tiers={tiers} />
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
