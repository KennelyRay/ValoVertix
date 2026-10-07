import { useCallback, useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  buildSkinCatalog,
  buildTierNormalizer,
  fetchGameVersion,
  indexBy,
  indexBuddies,
  indexMapsByUrl,
  indexSprays,
  latestTierSet,
  loadStatic,
  paidAgentIds,
  resolveOwned,
  type StaticKey,
} from "@valovertix/assets";
import {
  actRecord,
  aggregateMatches,
  computeSpending,
  currentRank,
  indexOffers,
  peakRank,
  radianiteToMax,
  rankHistory,
  resolveOwnedSkins,
  skinPriceVp,
  summarizeMatch,
  type MatchSummary,
  type PriceSource,
} from "@valovertix/calc";
import type { CatalogSkin } from "@valovertix/assets";
import {
  CURRENCY,
  createRiotClient,
  storefrontPrices,
  type ItemTypeKey,
  type RiotClient,
} from "@valovertix/riot";
import { MATCH_DETAILS_PAGE } from "@/config/app";
import { tierPriceVp } from "@/config/tier-prices";
import { riotKey } from "@/lib/query-client";
import { usePricing } from "./pricing";
import { useSettings } from "./settings-store";
import { useActiveSession, useSessionStore, type Session } from "./auth/session-store";

/** Nothing fetches until boot is done, so demo requests can never reach the real network. */
const useReady = () => !useSessionStore((s) => s.booting);

const HOUR = 3_600_000;

// ---- Static data (valorant-api.com) -------------------------------------------

export function useGameVersion() {
  const ready = useReady();
  return useQuery({
    queryKey: ["static", "version"],
    queryFn: ({ signal }) => fetchGameVersion(fetch, signal),
    staleTime: HOUR,
    enabled: ready,
  });
}

export function useStatic<K extends StaticKey>(key: K, enabled = true) {
  const version = useGameVersion().data?.version;
  return useQuery({
    queryKey: ["static", version, key],
    queryFn: ({ signal }) => loadStatic(key, version!, { signal }),
    enabled: Boolean(version) && enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

// ---- Riot data -------------------------------------------------------------------

function useClient(): { session: Session | null; client: RiotClient | null } {
  const session = useActiveSession();
  const ready = useReady();
  const client = useMemo(
    () => (session && ready ? createRiotClient(session) : null),
    [session, ready],
  );
  return { session, client };
}

function useRiotQuery<T>(
  name: string,
  fn: (c: RiotClient, signal: AbortSignal) => Promise<T>,
  {
    enabled = true,
    ...opts
  }: { enabled?: boolean; retryOnMount?: boolean; staleTime?: number } = {},
) {
  const { session, client } = useClient();
  return useQuery({
    queryKey: riotKey(session?.id ?? "none", session?.shard, name),
    queryFn: ({ signal }) => fn(client!, signal),
    enabled: Boolean(client) && enabled,
    ...opts,
  });
}

export const useOwned = (type: ItemTypeKey) =>
  useRiotQuery(`owned.${type}`, (c, s) => c.ownedItems(type, s));
// Prices change rarely. If the price list fails, don't re-request it on every page:
// the tier fallback takes over until the user retries.
export const useOffers = () =>
  useRiotQuery("offers", (c, s) => c.offers(s), { retryOnMount: false, staleTime: Infinity });
/** Exact prices for what is on sale now. Only requested when the full price list fails. */
export const useStorefront = (enabled: boolean) =>
  useRiotQuery("storefront", (c, s) => c.storefront(s), {
    enabled,
    retryOnMount: false,
    staleTime: 10 * 60_000,
  });
export const useWallet = () => useRiotQuery("wallet", (c, s) => c.wallet(s));
export const useLoadout = () => useRiotQuery("loadout", (c, s) => c.loadout(s));
export const useAccountXp = () => useRiotQuery("xp", (c, s) => c.accountXp(s));
export const useMmr = () => useRiotQuery("mmr", (c, s) => c.mmr(s));
export const useCompUpdates = () => useRiotQuery("compUpdates", (c, s) => c.competitiveUpdates(s));
export const useMatchHistory = () => useRiotQuery("matchHistory", (c, s) => c.matchHistory(s));

/** Loads match details lazily: only the first `count` matches are requested. */
export function useMatchSummaries(matchIds: readonly string[], count = MATCH_DETAILS_PAGE) {
  const { session, client } = useClient();
  const ids = matchIds.slice(0, count);
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: riotKey(session?.id ?? "none", session?.shard, "match", id),
      queryFn: ({ signal }: { signal: AbortSignal }) => client!.matchDetails(id, signal),
      enabled: Boolean(client),
      staleTime: Infinity,
    })),
    combine: (results) => ({
      results,
      summaries: results
        .map((r) => (r.data && session ? summarizeMatch(r.data, session.puuid) : null))
        .filter((m): m is MatchSummary => m !== null),
      loading: results.filter((r) => r.isPending).length,
      failed: results.filter((r) => r.isError).length,
    }),
  });
}

/** One match's full details; shares its cache entry with useMatchSummaries. */
export function useMatchDetails(matchId: string | null) {
  const { session, client } = useClient();
  return useQuery({
    queryKey: riotKey(session?.id ?? "none", session?.shard, "match", matchId ?? ""),
    queryFn: ({ signal }) => client!.matchDetails(matchId!, signal),
    enabled: Boolean(client && matchId),
    staleTime: Infinity,
  });
}

// ---- Derived -----------------------------------------------------------------------

export function useSkinCatalog() {
  const weapons = useStatic("weapons");
  const contracts = useStatic("contracts");
  const tiers = useStatic("contentTiers");
  const themes = useStatic("themes");
  const catalog = useMemo(
    () => (weapons.data && contracts.data ? buildSkinCatalog(weapons.data, contracts.data) : null),
    [weapons.data, contracts.data],
  );
  const tierById = useMemo(() => indexBy(tiers.data ?? []), [tiers.data]);
  const themeById = useMemo(() => indexBy(themes.data ?? []), [themes.data]);
  return {
    catalog,
    tierById,
    themeById,
    tiers: tiers.data ?? [],
    isPending: weapons.isPending || contracts.isPending || tiers.isPending,
    error: weapons.error ?? contracts.error ?? tiers.error ?? null,
  };
}

export function useOwnedSkins() {
  const { catalog, isPending: catalogPending, error: catalogError, ...rest } = useSkinCatalog();
  const levels = useOwned("skinLevel");
  const chromas = useOwned("skinChroma");
  const owned = useMemo(
    () =>
      catalog && levels.data
        ? resolveOwnedSkins(catalog.skins, levels.data, chromas.data ?? [])
        : null,
    [catalog, levels.data, chromas.data],
  );
  return {
    ...rest,
    catalog,
    owned,
    isPending: catalogPending || levels.isPending,
    error: levels.error ?? catalogError ?? null,
    /** Chromas failing should not hide the collection. */
    chromaError: chromas.error,
  };
}

export function useSpending() {
  const includeAgents = useSettings((s) => s.includeAgents);
  const skins = useOwnedSkins();
  const offers = useOffers();
  const agentsOwned = useOwned("agent");
  const agents = useStatic("agents");

  const { tierById } = skins;
  // Riot's full price list can be unavailable (404). Then skins on sale right now get
  // their exact storefront price, every other skin its tier's standard list price,
  // and the UI says so.
  const storefront = useStorefront(offers.isError);
  const priceSource: PriceSource | null = offers.data ? "offer" : offers.isError ? "tier" : null;
  const priceList = useMemo(
    () => offers.data ?? (storefront.data ? storefrontPrices(storefront.data) : []),
    [offers.data, storefront.data],
  );

  const priceIndex = useMemo(() => indexOffers(priceList), [priceList]);
  const fallbackVp = useMemo(
    () =>
      priceSource === "tier"
        ? (s: CatalogSkin) =>
            tierPriceVp(s.tierId ? tierById.get(s.tierId)?.devName : undefined, s.weaponCategory)
        : undefined,
    [priceSource, tierById],
  );

  const result = useMemo(() => {
    if (!skins.owned || !priceSource) return null;
    const paid = agents.data && agentsOwned.data ? paidAgentIds(agentsOwned.data, agents.data) : [];
    return computeSpending({
      ownedSkins: skins.owned,
      offers: priceIndex,
      currency: { vp: CURRENCY.vp, radianite: CURRENCY.radianite },
      includeAgents,
      paidAgentIds: paid,
      ...(fallbackVp && { fallbackVp }),
    });
  }, [
    skins.owned,
    priceIndex,
    priceSource,
    fallbackVp,
    agents.data,
    agentsOwned.data,
    includeAgents,
  ]);

  // Radianite still needed to unlock every level and variant of what you own.
  // Only Riot's full price list has upgrade prices.
  const upgradeToMax = useMemo(() => {
    if (!skins.owned || priceSource !== "offer") return null;
    return skins.owned.reduce(
      (acc, o) => {
        const r = radianiteToMax(o, priceIndex, CURRENCY.radianite);
        return { total: acc.total + r.total, items: acc.items + r.items };
      },
      { total: 0, items: 0 },
    );
  }, [skins.owned, priceIndex, priceSource]);

  /** A skin's VP price: Riot's store price, else (without the price list) its tier's price. */
  const priceOf = useCallback(
    (skin: CatalogSkin) =>
      priceSource ? skinPriceVp(skin, priceIndex, CURRENCY.vp, fallbackVp) : undefined,
    [priceIndex, priceSource, fallbackVp],
  );

  // Money comes from the regional pricing preference; VP amounts never change with it.
  const pricing = usePricing();
  const money = useMemo(() => (result ? pricing.value(result.totalVp) : null), [result, pricing]);
  const spent = useMemo(() => (result ? pricing.spent(result.totalVp) : null), [result, pricing]);
  return {
    ...skins,
    spending: result,
    /** Collection value in the chosen region, as a range. */
    money,
    /** Total spent: the cheapest real packs in the chosen region for all that VP. */
    spent,
    pricing,
    offerIndex: useMemo(() => (offers.data ? indexOffers(offers.data) : null), [offers.data]),
    priceSource,
    priceOf,
    upgradeToMax,
    /** Skins with an exact Riot price vs. ones priced by tier (only differs in "tier" mode). */
    exactCount: result?.priced.filter((p) => p.source === "offer").length ?? 0,
    tierCount: result?.priced.filter((p) => p.source === "tier").length ?? 0,
    agentsAvailable: Boolean(agentsOwned.data && agents.data),
    isPending: skins.isPending || offers.isPending,
    error: skins.error ?? null,
  };
}

export function useRanks() {
  const mmr = useMmr();
  const updates = useCompUpdates();
  const tierSets = useStatic("competitiveTiers");
  const seasons = useStatic("competitiveSeasons");
  const tiers = useMemo(() => latestTierSet(tierSets.data ?? []), [tierSets.data]);
  // Old acts used a different tier table (21-23 were Immortal); map them to today's scale.
  const normalize = useMemo(
    () => buildTierNormalizer(seasons.data ?? [], tierSets.data ?? []),
    [seasons.data, tierSets.data],
  );
  const current = mmr.data ? currentRank(mmr.data, undefined, normalize) : null;
  return {
    mmr,
    updates,
    tiers,
    current,
    /** Wins by tier in the current act, for the act-rank triangle. */
    act: mmr.data && current ? actRecord(mmr.data, current.seasonId, normalize) : null,
    peak: mmr.data ? peakRank(mmr.data, normalize) : null,
    history: updates.data ? rankHistory(updates.data, normalize) : [],
  };
}

export function useMatchStats(count: number) {
  const history = useMatchHistory();
  const ids = useMemo(() => history.data?.History.map((h) => h.MatchID) ?? [], [history.data]);
  const details = useMatchSummaries(ids, count);
  const aggregate = useMemo(() => aggregateMatches(details.summaries), [details.summaries]);
  const maps = useStatic("maps");
  const agents = useStatic("agents");
  return {
    history,
    ids,
    details,
    aggregate,
    mapByUrl: useMemo(() => indexMapsByUrl(maps.data ?? []), [maps.data]),
    agentById: useMemo(() => indexBy(agents.data ?? []), [agents.data]),
  };
}

export function useCollectibles() {
  const buddies = useStatic("buddies");
  const cards = useStatic("playerCards");
  const sprays = useStatic("sprays");
  const titles = useStatic("titles");
  const agents = useStatic("agents");
  const owned = {
    buddies: useOwned("buddy"),
    cards: useOwned("playerCard"),
    sprays: useOwned("spray"),
    titles: useOwned("title"),
    agents: useOwned("agent"),
  };
  return {
    buddies: useMemo(
      () =>
        buddies.data && owned.buddies.data
          ? resolveOwned(owned.buddies.data, indexBuddies(buddies.data))
          : null,
      [buddies.data, owned.buddies.data],
    ),
    cards: useMemo(
      () =>
        cards.data && owned.cards.data ? resolveOwned(owned.cards.data, indexBy(cards.data)) : null,
      [cards.data, owned.cards.data],
    ),
    sprays: useMemo(
      () =>
        sprays.data && owned.sprays.data
          ? resolveOwned(owned.sprays.data, indexSprays(sprays.data))
          : null,
      [sprays.data, owned.sprays.data],
    ),
    titles: useMemo(
      () =>
        titles.data && owned.titles.data
          ? resolveOwned(owned.titles.data, indexBy(titles.data))
          : null,
      [titles.data, owned.titles.data],
    ),
    agents: useMemo(() => {
      if (!agents.data || !owned.agents.data) return null;
      const ownedIds = new Set(owned.agents.data);
      // Starter agents are free for everyone and not listed in entitlements.
      return agents.data
        .filter((a) => a.isBaseContent || ownedIds.has(a.uuid.toLowerCase()))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
    }, [agents.data, owned.agents.data]),
    errors: Object.entries(owned)
      .filter(([, q]) => q.isError)
      .map(([k]) => k),
  };
}
