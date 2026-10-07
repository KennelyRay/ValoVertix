import { kda, type MatchDetailsLike, type RankPoint } from "./stats";

// ---- Round-level combat ----------------------------------------------------

export interface KillLike {
  roundTime?: number | undefined;
  killer?: string | null | undefined;
  victim: string;
  finishingDamage?: { damageType: string; damageItem: string } | null | undefined;
}

export interface DamageLike {
  receiver: string;
  damage: number;
  headshots: number;
  bodyshots: number;
  legshots: number;
}

export interface RoundLike {
  roundNum: number;
  roundResult?: string | undefined;
  winningTeam: string;
  playerStats?:
    | readonly {
        subject: string;
        kills?: readonly KillLike[] | null | undefined;
        damage?: readonly DamageLike[] | null | undefined;
      }[]
    | null
    | undefined;
}

export interface CombatStats {
  damage: number;
  headshots: number;
  bodyshots: number;
  legshots: number;
  /** Rounds where this player got the round's first kill / died first. */
  firstKills: number;
  firstDeaths: number;
  /** Kills by finishing weapon UUID (lowercase). Ability and other kills are left out. */
  weaponKills: Record<string, number>;
}

const empty = (): CombatStats => ({
  damage: 0,
  headshots: 0,
  bodyshots: 0,
  legshots: 0,
  firstKills: 0,
  firstDeaths: 0,
  weaponKills: {},
});

const lc = (s: string) => s.toLowerCase();

/** Per-player combat stats for a match, keyed by lowercase PUUID. Empty when Riot sent no rounds. */
export function combatBySubject(rounds: readonly RoundLike[] | null | undefined) {
  const out = new Map<string, CombatStats>();
  const get = (subject: string) => {
    const key = lc(subject);
    let s = out.get(key);
    if (!s) out.set(key, (s = empty()));
    return s;
  };
  for (const round of rounds ?? []) {
    const kills: KillLike[] = [];
    for (const ps of round.playerStats ?? []) {
      const s = get(ps.subject);
      for (const d of ps.damage ?? []) {
        s.damage += d.damage;
        s.headshots += d.headshots;
        s.bodyshots += d.bodyshots;
        s.legshots += d.legshots;
      }
      for (const k of ps.kills ?? []) {
        kills.push(k);
        const f = k.finishingDamage;
        if (f?.damageType === "Weapon" && f.damageItem) {
          const w = lc(f.damageItem);
          s.weaponKills[w] = (s.weaponKills[w] ?? 0) + 1;
        }
      }
    }
    const first = kills.reduce<KillLike | null>(
      (best, k) => (!best || (k.roundTime ?? Infinity) < (best.roundTime ?? Infinity) ? k : best),
      null,
    );
    if (first) {
      if (first.killer) get(first.killer).firstKills += 1;
      get(first.victim).firstDeaths += 1;
    }
  }
  return out;
}

/** Headshot share of all hits, or null with no hits recorded. */
export const headshotRate = (s: Pick<CombatStats, "headshots" | "bodyshots" | "legshots">) => {
  const hits = s.headshots + s.bodyshots + s.legshots;
  return hits ? s.headshots / hits : null;
};

// ---- Scoreboard ------------------------------------------------------------

export interface ScoreboardPlayer {
  subject: string;
  /** Riot ID parts as sent by Riot; empty for hidden (incognito) players. */
  gameName: string;
  tagLine: string;
  teamId: string;
  partyId: string | null;
  agentId: string | null;
  tier: number;
  acs: number;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  headshotRate: number | null;
  /** Average damage per round, or null without round data. */
  adr: number | null;
  firstKills: number;
  isMe: boolean;
}

export interface ScoreboardTeam {
  teamId: string;
  won: boolean;
  roundsWon: number;
  players: ScoreboardPlayer[];
}

export interface Scoreboard {
  /** The viewer's team first. */
  teams: ScoreboardTeam[];
  rounds: { num: number; winningTeam: string; result: string }[];
  myTeamId: string | null;
}

export interface FullMatchLike extends MatchDetailsLike {
  players: readonly (MatchDetailsLike["players"][number] & {
    gameName?: string | null | undefined;
    tagLine?: string | null | undefined;
    partyId?: string | null | undefined;
    competitiveTier?: number | undefined;
  })[];
  roundResults?: readonly RoundLike[] | null | undefined;
}

export function buildScoreboard(details: FullMatchLike, puuid: string): Scoreboard {
  const combat = combatBySubject(details.roundResults);
  const hasRounds = Boolean(details.roundResults?.length);
  const me = lc(puuid);
  const players: ScoreboardPlayer[] = details.players.map((p) => {
    const s = p.stats;
    const c = combat.get(lc(p.subject)) ?? empty();
    const rounds = s?.roundsPlayed ?? 0;
    return {
      subject: p.subject,
      gameName: p.gameName ?? "",
      tagLine: p.tagLine ?? "",
      teamId: p.teamId,
      partyId: p.partyId ?? null,
      agentId: p.characterId ? lc(p.characterId) : null,
      tier: p.competitiveTier ?? 0,
      acs: rounds ? s!.score / rounds : 0,
      kills: s?.kills ?? 0,
      deaths: s?.deaths ?? 0,
      assists: s?.assists ?? 0,
      kda: kda(s?.kills ?? 0, s?.deaths ?? 0, s?.assists ?? 0),
      headshotRate: headshotRate(c),
      adr: hasRounds && rounds ? c.damage / rounds : null,
      firstKills: c.firstKills,
      isMe: lc(p.subject) === me,
    };
  });
  const myTeamId = players.find((p) => p.isMe)?.teamId ?? null;
  const others = [...new Set(players.map((p) => p.teamId))]
    .filter((id) => id !== myTeamId)
    .sort((a, b) => a.localeCompare(b));
  const teamIds = myTeamId ? [myTeamId, ...others] : others;
  return {
    myTeamId,
    teams: teamIds.map((teamId) => {
      const t = details.teams?.find((x) => x.teamId === teamId);
      return {
        teamId,
        won: t?.won ?? false,
        roundsWon: t?.roundsWon ?? 0,
        players: players.filter((p) => p.teamId === teamId).sort((a, b) => b.acs - a.acs),
      };
    }),
    rounds: (details.roundResults ?? [])
      .map((r) => ({ num: r.roundNum, winningTeam: r.winningTeam, result: r.roundResult ?? "" }))
      .sort((a, b) => a.num - b.num),
  };
}

// ---- Ranked session --------------------------------------------------------

export interface RankedSession {
  /** Newest first. */
  games: RankPoint[];
  net: number;
  wins: number;
  losses: number;
  draws: number;
  /** Rank before the session's first game, when an earlier game is known. */
  before: { tier: number; rr: number } | null;
  after: { tier: number; rr: number };
  startedAt: number;
  endedAt: number;
}

/**
 * The latest run of ranked games, where each game started within `gapMs` of
 * the previous one. Wins and losses are read from the RR change.
 */
export function rankedSession(
  points: readonly RankPoint[],
  gapMs = 3 * 60 * 60 * 1000,
): RankedSession | null {
  const sorted = [...points].sort((a, b) => a.time - b.time);
  const last = sorted.at(-1);
  if (!last) return null;
  let start = sorted.length - 1;
  while (start > 0 && sorted[start]!.time - sorted[start - 1]!.time <= gapMs) start -= 1;
  const games = sorted.slice(start).reverse();
  const prev = sorted[start - 1];
  return {
    games,
    net: games.reduce((s, g) => s + g.delta, 0),
    wins: games.filter((g) => g.delta > 0).length,
    losses: games.filter((g) => g.delta < 0).length,
    draws: games.filter((g) => g.delta === 0).length,
    before: prev ? { tier: prev.tier, rr: prev.rr } : null,
    after: { tier: last.tier, rr: last.rr },
    startedAt: sorted[start]!.time,
    endedAt: last.time,
  };
}
