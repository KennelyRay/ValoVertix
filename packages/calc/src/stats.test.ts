import { describe, expect, it } from "vitest";
import {
  acs,
  actRecord,
  aggregateMatches,
  currentRank,
  kda,
  peakRank,
  rankHistory,
  summarizeMatch,
  type CompUpdateLike,
  type MatchDetailsLike,
  type MatchSummary,
} from "./stats";

const ME = "ME-PUUID";

const update = (over: Partial<CompUpdateLike>): CompUpdateLike => ({
  MatchID: "m",
  MapID: "/Game/Maps/Ascent/Ascent",
  SeasonID: "s1",
  MatchStartTime: 0,
  TierAfterUpdate: 15,
  RankedRatingAfterUpdate: 50,
  RankedRatingEarned: 20,
  ...over,
});

describe("ranks", () => {
  const mmr = {
    QueueSkills: {
      competitive: {
        SeasonalInfoBySeasonID: {
          s1: {
            SeasonID: "s1",
            CompetitiveTier: 12,
            RankedRating: 0,
            WinsByTier: { "14": 3, "16": 0 },
          },
          s2: { SeasonID: "s2", CompetitiveTier: 15, RankedRating: 40, WinsByTier: null },
          s3: { SeasonID: "s3", CompetitiveTier: 0, RankedRating: 0 },
        },
      },
    },
    LatestCompetitiveUpdate: update({
      TierAfterUpdate: 15,
      RankedRatingAfterUpdate: 42,
      SeasonID: "s2",
    }),
  };

  it("finds the peak from wins and final tiers", () => {
    expect(peakRank(mmr)).toEqual({ tier: 15, seasonId: "s2" });
    const winsOnly = {
      QueueSkills: {
        competitive: {
          SeasonalInfoBySeasonID: {
            a: { SeasonID: "a", CompetitiveTier: 10, RankedRating: 0, WinsByTier: { "18": 1 } },
          },
        },
      },
    };
    expect(peakRank(winsOnly)).toEqual({ tier: 18, seasonId: "a" });
  });

  it("compares peaks across acts on the current tier scale", () => {
    // s1 is an old act where 23 meant Immortal 3 (26 today); s2 reached 24 (Immortal 1 today).
    const mixed = {
      QueueSkills: {
        competitive: {
          SeasonalInfoBySeasonID: {
            s1: { SeasonID: "s1", CompetitiveTier: 23, RankedRating: 0, WinsByTier: null },
            s2: { SeasonID: "s2", CompetitiveTier: 24, RankedRating: 0, WinsByTier: null },
          },
        },
      },
    };
    const normalize = (season: string, tier: number) =>
      season === "s1" && tier === 23 ? 26 : tier;
    expect(peakRank(mixed)).toEqual({ tier: 24, seasonId: "s2" });
    expect(peakRank(mixed, normalize)).toEqual({ tier: 26, seasonId: "s1" });
    expect(currentRank(mixed, "s1", normalize)).toEqual({ tier: 26, rr: 0, seasonId: "s1" });
    const old = update({ SeasonID: "s1", TierAfterUpdate: 23, RankedRatingAfterUpdate: 10 });
    expect(currentRank({ LatestCompetitiveUpdate: old }, undefined, normalize)?.tier).toBe(26);
    expect(rankHistory([old], normalize)[0]).toMatchObject({ tier: 26, value: 2610 });
  });

  it("returns null peak for unranked or missing data", () => {
    expect(peakRank({})).toBeNull();
    expect(peakRank({ QueueSkills: { competitive: { SeasonalInfoBySeasonID: null } } })).toBeNull();
    expect(peakRank({ QueueSkills: null })).toBeNull();
  });

  it("reads the current rank", () => {
    expect(currentRank(mmr)).toEqual({ tier: 15, rr: 42, seasonId: "s2" });
    expect(currentRank(mmr, "s1")).toEqual({ tier: 12, rr: 0, seasonId: "s1" });
    expect(currentRank(mmr, "missing")).toEqual({ tier: 15, rr: 42, seasonId: "s2" });
    expect(currentRank({ LatestCompetitiveUpdate: update({ TierAfterUpdate: 0 }) })).toBeNull();
    expect(currentRank({ LatestCompetitiveUpdate: null })).toBeNull();
  });

  it("builds an oldest-first rank history without unranked points", () => {
    const h = rankHistory([
      update({ MatchID: "b", MatchStartTime: 2, TierAfterUpdate: 16, RankedRatingAfterUpdate: 5 }),
      update({ MatchID: "a", MatchStartTime: 1 }),
      update({ MatchID: "c", MatchStartTime: 3, TierAfterUpdate: 0 }),
    ]);
    expect(h.map((p) => p.matchId)).toEqual(["a", "b"]);
    expect(h[1]?.value).toBe(1605);
  });
});

function details(over: {
  myTeam?: string;
  teams?: MatchDetailsLike["teams"];
  stats?: MatchDetailsLike["players"][number]["stats"];
  characterId?: string | null;
}): MatchDetailsLike {
  return {
    matchInfo: {
      matchId: "m1",
      mapId: "/Game/Maps/Bonsai/Bonsai",
      gameStartMillis: 5,
      queueID: "competitive",
    },
    players: [
      {
        subject: "me-puuid",
        teamId: over.myTeam ?? "Blue",
        characterId: over.characterId === undefined ? "AGENT-JETT" : over.characterId,
        stats:
          over.stats === undefined
            ? { score: 4000, roundsPlayed: 24, kills: 20, deaths: 10, assists: 5 }
            : over.stats,
      },
      { subject: "other", teamId: "Red", stats: null },
    ],
    teams:
      over.teams === undefined
        ? [
            { teamId: "Blue", won: true, roundsWon: 13 },
            { teamId: "Red", won: false, roundsWon: 11 },
          ]
        : over.teams,
  };
}

describe("summarizeMatch", () => {
  it("summarizes a win from my perspective", () => {
    expect(summarizeMatch(details({}), ME)).toEqual({
      matchId: "m1",
      mapId: "/Game/Maps/Bonsai/Bonsai",
      queueId: "competitive",
      startedAt: 5,
      agentId: "agent-jett",
      result: "win",
      teamScore: 13,
      enemyScore: 11,
      kills: 20,
      deaths: 10,
      assists: 5,
      score: 4000,
      roundsPlayed: 24,
      combat: null,
    });
  });

  it("detects losses and draws", () => {
    expect(summarizeMatch(details({ myTeam: "Red" }), ME)?.result).toBe("loss");
    const draw = details({
      teams: [
        { teamId: "Blue", won: false, roundsWon: 12 },
        { teamId: "Red", won: false, roundsWon: 12 },
      ],
    });
    expect(summarizeMatch(draw, ME)?.result).toBe("draw");
  });

  it("copes with missing teams, stats and agent", () => {
    const s = summarizeMatch(details({ teams: null, stats: null, characterId: null }), ME);
    expect(s).toMatchObject({
      result: "loss",
      teamScore: null,
      enemyScore: null,
      kills: 0,
      agentId: null,
    });
  });

  it("returns null when the player isn't in the match", () => {
    expect(summarizeMatch(details({}), "nobody")).toBeNull();
  });
});

describe("aggregateMatches", () => {
  const m = (over: Partial<MatchSummary>): MatchSummary => ({
    matchId: "x",
    mapId: "ascent",
    queueId: "competitive",
    startedAt: 0,
    agentId: "jett",
    result: "win",
    teamScore: 13,
    enemyScore: 5,
    kills: 10,
    deaths: 5,
    assists: 5,
    score: 0,
    roundsPlayed: 18,
    combat: null,
    ...over,
  });

  it("computes win rate, KDA, agents and maps", () => {
    const agg = aggregateMatches([
      m({}),
      m({ result: "loss", mapId: "bind", kills: 5, deaths: 10, assists: 0 }),
      m({ agentId: "sova", result: "draw", mapId: "bind" }),
      m({ agentId: null }),
    ]);
    expect(agg).toMatchObject({ games: 4, wins: 2, losses: 1, draws: 1, winRate: 0.5 });
    expect(agg.kda).toBeCloseTo((35 + 15) / 25);
    expect(agg.agents.map((a) => [a.key, a.games])).toEqual([
      ["jett", 2],
      ["sova", 1],
    ]);
    expect(agg.maps.map((x) => [x.key, x.winRate])).toEqual([
      ["ascent", 1],
      ["bind", 0],
    ]);
  });

  it("orders ties deterministically", () => {
    const agg = aggregateMatches([
      m({ agentId: "b", mapId: "y" }),
      m({ agentId: "a", mapId: "x" }),
    ]);
    expect(agg.agents.map((a) => a.key)).toEqual(["a", "b"]);
    expect(agg.maps.map((a) => a.key)).toEqual(["x", "y"]);
    const byWinRate = aggregateMatches([m({ agentId: "b" }), m({ agentId: "a", result: "loss" })]);
    expect(byWinRate.agents.map((a) => a.key)).toEqual(["b", "a"]);
    const byGames = aggregateMatches([m({ mapId: "y" }), m({ mapId: "x" }), m({ mapId: "x" })]);
    expect(byGames.maps.map((a) => a.key)).toEqual(["x", "y"]);
  });

  it("handles no matches and zero deaths", () => {
    expect(aggregateMatches([])).toMatchObject({ games: 0, winRate: 0, kda: 0 });
    expect(kda(3, 0, 1)).toBe(4);
  });
});

describe("actRecord and acs", () => {
  const mmr = {
    QueueSkills: {
      competitive: {
        SeasonalInfoBySeasonID: {
          act: {
            SeasonID: "act",
            CompetitiveTier: 18,
            RankedRating: 0,
            WinsByTier: { "16": 2, "18": 1, "17": 0, junk: 3 },
            NumberOfWins: 3,
            NumberOfGames: 7,
          },
          bare: { SeasonID: "bare", CompetitiveTier: 0, RankedRating: 0, WinsByTier: null },
        },
      },
    },
  };

  it("lists wins by tier, highest first, with act totals", () => {
    expect(actRecord(mmr, "act")).toEqual({
      seasonId: "act",
      winTiers: [18, 16, 16],
      wins: 3,
      games: 7,
    });
  });

  it("maps old-act tiers and falls back when totals are missing", () => {
    expect(actRecord(mmr, "act", (_s, t) => t + 3)?.winTiers).toEqual([21, 19, 19]);
    expect(actRecord(mmr, "bare")).toEqual({ seasonId: "bare", winTiers: [], wins: 0, games: 0 });
  });

  it("returns null without an act", () => {
    expect(actRecord(mmr, null)).toBeNull();
    expect(actRecord(mmr, "missing")).toBeNull();
    expect(actRecord({}, "act")).toBeNull();
  });

  it("computes average combat score", () => {
    expect(
      acs([
        { score: 4000, roundsPlayed: 20 },
        { score: 2000, roundsPlayed: 20 },
      ]),
    ).toBe(150);
    expect(acs([])).toBe(0);
  });
});
