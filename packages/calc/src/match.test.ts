import { describe, expect, it } from "vitest";
import {
  buildScoreboard,
  combatBySubject,
  headshotRate,
  rankedSession,
  type FullMatchLike,
  type RoundLike,
} from "./match";
import { aggregateMatches, summarizeMatch, type MatchSummary, type RankPoint } from "./stats";

const VANDAL = "9C82E19D-4575-0200-1A81-3EACF00CF872";
const rounds: RoundLike[] = [
  {
    roundNum: 1,
    roundResult: "Eliminated",
    winningTeam: "Blue",
    playerStats: [
      {
        subject: "ME",
        kills: [
          {
            roundTime: 9000,
            killer: "ME",
            victim: "e1",
            finishingDamage: { damageType: "Weapon", damageItem: VANDAL },
          },
          {
            roundTime: 20000,
            killer: "ME",
            victim: "e2",
            finishingDamage: { damageType: "Ability", damageItem: "GrenadeAbility" },
          },
        ],
        damage: [
          { receiver: "e1", damage: 160, headshots: 1, bodyshots: 1, legshots: 0 },
          { receiver: "e2", damage: 80, headshots: 0, bodyshots: 1, legshots: 1 },
        ],
      },
      {
        subject: "e1",
        kills: [{ roundTime: 15000, killer: "e1", victim: "m2", finishingDamage: null }],
        damage: null,
      },
    ],
  },
  {
    roundNum: 0,
    winningTeam: "Red",
    playerStats: [
      {
        subject: "e1",
        kills: [
          // A kill with no time never counts as the first one.
          { victim: "m2" },
          {
            roundTime: 5000,
            killer: "e1",
            victim: "ME",
            finishingDamage: { damageType: "Weapon", damageItem: VANDAL },
          },
        ],
      },
      { subject: "ME", kills: null, damage: [] },
    ],
  },
  { roundNum: 2, winningTeam: "Blue", playerStats: null },
];

describe("combatBySubject", () => {
  const c = combatBySubject(rounds);

  it("sums damage, hits and weapon kills per player", () => {
    expect(c.get("me")).toEqual({
      damage: 240,
      headshots: 1,
      bodyshots: 2,
      legshots: 1,
      firstKills: 1,
      firstDeaths: 1,
      weaponKills: { [VANDAL.toLowerCase()]: 1 },
    });
    expect(c.get("e1")).toMatchObject({ firstKills: 1, firstDeaths: 1 });
    expect(c.has("m2")).toBe(false);
  });

  it("handles missing rounds and killerless first kills", () => {
    expect(combatBySubject(null).size).toBe(0);
    const spike = combatBySubject([
      {
        roundNum: 0,
        winningTeam: "Red",
        playerStats: [{ subject: "x", kills: [{ victim: "y" }, { victim: "z" }] }],
      },
    ]);
    expect(spike.get("y")?.firstDeaths).toBe(1);
    expect(spike.get("x")?.firstKills).toBe(0);
  });

  it("computes headshot rate", () => {
    expect(headshotRate({ headshots: 1, bodyshots: 2, legshots: 1 })).toBe(0.25);
    expect(headshotRate({ headshots: 0, bodyshots: 0, legshots: 0 })).toBeNull();
  });
});

const player = (subject: string, teamId: string, kills: number, extra = {}) => ({
  subject,
  teamId,
  characterId: "AGENT",
  stats: { score: kills * 300, roundsPlayed: 3, kills, deaths: 2, assists: 1 },
  ...extra,
});

const match: FullMatchLike = {
  matchInfo: {
    matchId: "m",
    mapId: "/Game/Maps/Ascent",
    gameStartMillis: 1,
    queueID: "competitive",
  },
  players: [
    player("ME", "Blue", 2, { gameName: "Me", tagLine: "001", partyId: "p", competitiveTier: 12 }),
    player("m2", "Blue", 4),
    player("e1", "Red", 3, { characterId: null, stats: null }),
    player("e2", "Red", 1),
  ],
  teams: [
    { teamId: "Red", won: false, roundsWon: 1 },
    { teamId: "Blue", won: true, roundsWon: 2 },
  ],
  roundResults: rounds,
};

describe("buildScoreboard", () => {
  it("puts the viewer's team first, sorted by ACS, with round results in order", () => {
    const b = buildScoreboard(match, "me");
    expect(b.myTeamId).toBe("Blue");
    expect(b.teams.map((t) => [t.teamId, t.won, t.roundsWon])).toEqual([
      ["Blue", true, 2],
      ["Red", false, 1],
    ]);
    expect(b.teams[0]!.players.map((p) => p.subject)).toEqual(["m2", "ME"]);
    expect(b.teams[0]!.players[1]).toMatchObject({
      gameName: "Me",
      tagLine: "001",
      partyId: "p",
      agentId: "agent",
      tier: 12,
      acs: 200,
      kda: 1.5,
      headshotRate: 0.25,
      adr: 80,
      firstKills: 1,
      isMe: true,
    });
    expect(b.teams[1]!.players.find((p) => p.subject === "e1")).toMatchObject({
      gameName: "",
      tagLine: "",
      partyId: null,
      agentId: null,
      tier: 0,
      acs: 0,
      kills: 0,
      headshotRate: null,
    });
    expect(b.rounds.map((r) => [r.num, r.winningTeam, r.result])).toEqual([
      [0, "Red", ""],
      [1, "Blue", "Eliminated"],
      [2, "Blue", ""],
    ]);
  });

  it("works without rounds, teams or the viewer", () => {
    const b = buildScoreboard({ ...match, teams: null, roundResults: null }, "nobody");
    expect(b.myTeamId).toBeNull();
    expect(b.teams.map((t) => t.teamId)).toEqual(["Blue", "Red"]);
    expect(b.teams[0]).toMatchObject({ won: false, roundsWon: 0 });
    expect(b.teams[0]!.players[0]!.adr).toBeNull();
    expect(b.rounds).toEqual([]);
  });
});

describe("combat in summaries and aggregates", () => {
  it("summarizes the viewer's combat", () => {
    expect(summarizeMatch(match, "ME")?.combat?.headshots).toBe(1);
    expect(summarizeMatch({ ...match, roundResults: [] }, "ME")?.combat).toBeNull();
    const noStats = { ...match, roundResults: [{ roundNum: 0, winningTeam: "Red" }] };
    expect(summarizeMatch(noStats, "ME")?.combat).toBeNull();
  });

  it("aggregates headshot rate, ADR, first kills and weapons", () => {
    const base = summarizeMatch(match, "ME")!;
    const other: MatchSummary = {
      ...base,
      matchId: "n",
      roundsPlayed: 2,
      combat: {
        damage: 60,
        headshots: 3,
        bodyshots: 0,
        legshots: 0,
        firstKills: 0,
        firstDeaths: 2,
        weaponKills: { [VANDAL.toLowerCase()]: 1, sheriff: 2 },
      },
    };
    const agg = aggregateMatches([base, other, { ...base, matchId: "o", combat: null }]);
    expect(agg.headshotRate).toBe(4 / 7);
    expect(agg.adr).toBe(300 / 5);
    expect(agg.firstKills).toBe(1);
    expect(agg.firstDeaths).toBe(3);
    expect(agg.weapons).toEqual([
      { key: VANDAL.toLowerCase(), kills: 2 },
      { key: "sheriff", kills: 2 },
    ]);
    const none = aggregateMatches([{ ...base, combat: null }]);
    expect(none).toMatchObject({ headshotRate: null, adr: null, weapons: [] });
  });
});

describe("rankedSession", () => {
  const H = 60 * 60 * 1000;
  const p = (time: number, delta: number, tier = 15, rr = 50): RankPoint => ({
    matchId: String(time),
    time,
    tier,
    rr,
    delta,
    mapId: "m",
    value: tier * 100 + rr,
  });

  it("groups the latest games played close together", () => {
    const s = rankedSession([
      p(10 * H, 20, 15, 70),
      p(0, -15, 14, 90),
      p(9 * H, 0),
      p(8 * H, -10),
    ])!;
    expect(s.games.map((g) => g.time)).toEqual([10 * H, 9 * H, 8 * H]);
    expect(s).toMatchObject({
      net: 10,
      wins: 1,
      losses: 1,
      draws: 1,
      before: { tier: 14, rr: 90 },
      after: { tier: 15, rr: 70 },
      startedAt: 8 * H,
      endedAt: 10 * H,
    });
  });

  it("handles a single game and no games", () => {
    expect(rankedSession([p(0, 18)])).toMatchObject({ before: null, wins: 1, net: 18 });
    expect(rankedSession([])).toBeNull();
  });
});
