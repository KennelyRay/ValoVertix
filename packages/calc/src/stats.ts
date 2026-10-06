// Structural types so this package stays free of the Riot client.

export interface SeasonLike {
  SeasonID: string;
  CompetitiveTier: number;
  RankedRating: number;
  WinsByTier?: Readonly<Record<string, number>> | null | undefined;
}

export interface MmrLike {
  QueueSkills?: Readonly<
    Record<
      string,
      { SeasonalInfoBySeasonID?: Readonly<Record<string, SeasonLike>> | null | undefined }
    >
  > | null;
  LatestCompetitiveUpdate?: CompUpdateLike | null | undefined;
}

export interface CompUpdateLike {
  MatchID: string;
  MapID: string;
  SeasonID: string;
  MatchStartTime: number;
  TierAfterUpdate: number;
  RankedRatingAfterUpdate: number;
  RankedRatingEarned: number;
}

export interface RankSnapshot {
  tier: number;
  rr: number;
  seasonId: string | null;
}

/** Current rank from the latest competitive update, falling back to the newest season entry. */
/**
 * Maps a tier from a given act onto the current tier scale (tier tables
 * changed in 2022). Defaults to leaving tiers as they are.
 */
export type TierNormalizer = (seasonId: string, tier: number) => number;
const identity: TierNormalizer = (_season, tier) => tier;

export function currentRank(
  mmr: MmrLike,
  currentSeasonId?: string,
  normalize: TierNormalizer = identity,
): RankSnapshot | null {
  const latest = mmr.LatestCompetitiveUpdate;
  const seasons = mmr.QueueSkills?.competitive?.SeasonalInfoBySeasonID ?? {};
  if (currentSeasonId) {
    const s = seasons[currentSeasonId];
    if (s) {
      return {
        tier: normalize(s.SeasonID, s.CompetitiveTier),
        rr: s.RankedRating,
        seasonId: s.SeasonID,
      };
    }
  }
  if (latest && latest.TierAfterUpdate > 0) {
    return {
      tier: normalize(latest.SeasonID, latest.TierAfterUpdate),
      rr: latest.RankedRatingAfterUpdate,
      seasonId: latest.SeasonID,
    };
  }
  return null;
}

/**
 * Highest tier ever reached in competitive: the best tier with a recorded
 * win (WinsByTier) or the best final tier of any season.
 */
export function peakRank(
  mmr: MmrLike,
  normalize: TierNormalizer = identity,
): { tier: number; seasonId: string } | null {
  const seasons = Object.values(mmr.QueueSkills?.competitive?.SeasonalInfoBySeasonID ?? {});
  let best: { tier: number; seasonId: string } | null = null;
  for (const s of seasons) {
    const winTiers = Object.entries(s.WinsByTier ?? {})
      .filter(([, wins]) => wins > 0)
      .map(([tier]) => Number(tier))
      .filter(Number.isFinite);
    // Each act's tiers are mapped to today's scale before comparing across acts.
    const tier = normalize(s.SeasonID, Math.max(s.CompetitiveTier, ...winTiers));
    if (tier > 0 && (!best || tier > best.tier)) best = { tier, seasonId: s.SeasonID };
  }
  return best;
}

export interface RankPoint {
  matchId: string;
  time: number;
  tier: number;
  rr: number;
  delta: number;
  mapId: string;
  /** tier * 100 + rr, a single monotone axis for charting. */
  value: number;
}

/** Competitive updates as an oldest-first series, skipping placement/unranked entries. */
export function rankHistory(
  updates: readonly CompUpdateLike[],
  normalize: TierNormalizer = identity,
): RankPoint[] {
  return updates
    .filter((u) => u.TierAfterUpdate > 0)
    .map((u) => {
      const tier = normalize(u.SeasonID, u.TierAfterUpdate);
      return {
        matchId: u.MatchID,
        time: u.MatchStartTime,
        tier,
        rr: u.RankedRatingAfterUpdate,
        delta: u.RankedRatingEarned,
        mapId: u.MapID,
        value: tier * 100 + u.RankedRatingAfterUpdate,
      };
    })
    .sort((a, b) => a.time - b.time);
}

// ---- Matches -------------------------------------------------------------

export interface MatchDetailsLike {
  matchInfo: { matchId: string; mapId: string; gameStartMillis: number; queueID: string };
  players: readonly {
    subject: string;
    teamId: string;
    characterId?: string | null | undefined;
    stats?:
      | { score: number; roundsPlayed: number; kills: number; deaths: number; assists: number }
      | null
      | undefined;
  }[];
  teams?: readonly { teamId: string; won: boolean; roundsWon: number }[] | null | undefined;
}

export type MatchResult = "win" | "loss" | "draw";

export interface MatchSummary {
  matchId: string;
  mapId: string;
  queueId: string;
  startedAt: number;
  agentId: string | null;
  result: MatchResult;
  teamScore: number | null;
  enemyScore: number | null;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  roundsPlayed: number;
}

/** Summarizes one match from the given player's point of view, or null if they aren't in it. */
export function summarizeMatch(details: MatchDetailsLike, puuid: string): MatchSummary | null {
  const me = details.players.find((p) => p.subject.toLowerCase() === puuid.toLowerCase());
  if (!me) return null;
  const teams = details.teams ?? [];
  const mine = teams.find((t) => t.teamId === me.teamId);
  const others = teams.filter((t) => t.teamId !== me.teamId);
  const enemyScore = others.length ? Math.max(...others.map((t) => t.roundsWon)) : null;

  let result: MatchResult = "loss";
  if (mine?.won) result = "win";
  else if (mine && !teams.some((t) => t.won) && enemyScore === mine.roundsWon) result = "draw";

  const s = me.stats;
  return {
    matchId: details.matchInfo.matchId,
    mapId: details.matchInfo.mapId,
    queueId: details.matchInfo.queueID,
    startedAt: details.matchInfo.gameStartMillis,
    agentId: me.characterId ? me.characterId.toLowerCase() : null,
    result,
    teamScore: mine?.roundsWon ?? null,
    enemyScore,
    kills: s?.kills ?? 0,
    deaths: s?.deaths ?? 0,
    assists: s?.assists ?? 0,
    score: s?.score ?? 0,
    roundsPlayed: s?.roundsPlayed ?? 0,
  };
}

export const kda = (k: number, d: number, a: number) => (k + a) / Math.max(1, d);

export interface GroupStats {
  key: string;
  games: number;
  wins: number;
  winRate: number;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
}

export interface MatchAggregate {
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  /** Most played first. */
  agents: GroupStats[];
  /** Best win rate first (ties: more games first). */
  maps: GroupStats[];
}

function group(summaries: readonly MatchSummary[], key: (m: MatchSummary) => string | null) {
  const map = new Map<string, MatchSummary[]>();
  for (const m of summaries) {
    const k = key(m);
    if (!k) continue;
    map.set(k, [...(map.get(k) ?? []), m]);
  }
  return [...map.entries()].map(([k, ms]): GroupStats => {
    const wins = ms.filter((m) => m.result === "win").length;
    const kills = ms.reduce((s, m) => s + m.kills, 0);
    const deaths = ms.reduce((s, m) => s + m.deaths, 0);
    const assists = ms.reduce((s, m) => s + m.assists, 0);
    return {
      key: k,
      games: ms.length,
      wins,
      winRate: wins / ms.length,
      kills,
      deaths,
      assists,
      kda: kda(kills, deaths, assists),
    };
  });
}

export function aggregateMatches(summaries: readonly MatchSummary[]): MatchAggregate {
  const games = summaries.length;
  const wins = summaries.filter((m) => m.result === "win").length;
  const draws = summaries.filter((m) => m.result === "draw").length;
  const kills = summaries.reduce((s, m) => s + m.kills, 0);
  const deaths = summaries.reduce((s, m) => s + m.deaths, 0);
  const assists = summaries.reduce((s, m) => s + m.assists, 0);
  return {
    games,
    wins,
    losses: games - wins - draws,
    draws,
    winRate: games ? wins / games : 0,
    kills,
    deaths,
    assists,
    kda: kda(kills, deaths, assists),
    agents: group(summaries, (m) => m.agentId).sort(
      (a, b) => b.games - a.games || b.winRate - a.winRate || a.key.localeCompare(b.key),
    ),
    maps: group(summaries, (m) => m.mapId).sort(
      (a, b) => b.winRate - a.winRate || b.games - a.games || a.key.localeCompare(b.key),
    ),
  };
}
