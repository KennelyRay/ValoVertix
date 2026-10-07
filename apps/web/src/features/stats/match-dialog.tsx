import { useMemo } from "react";
import { Users } from "lucide-react";
import type { Agent, CompetitiveTier, GameMap } from "@valovertix/assets";
import { buildScoreboard, summarizeMatch, type ScoreboardPlayer } from "@valovertix/calc";
import { LoadingBlock } from "@/components/shared";
import { Dialog, ErrorNote } from "@/components/ui/primitives";
import { useActiveSession } from "@/features/auth/session-store";
import { useMatchDetails } from "@/features/data";
import { cn } from "@/lib/cn";
import { useIsPhone } from "@/lib/use-media";
import { fmtDateTime, fmtDec, fmtPct, queueName, titleCase } from "@/lib/format";

const RESULT_TEXT = { win: "Victory", loss: "Defeat", draw: "Draw" } as const;
const RESULT_TONE = { win: "text-win", loss: "text-loss", draw: "text-muted" } as const;

/** Rounds are 0-indexed in Riot's data; regulation halves are 12 rounds. */
const HALF = 12;

function Duration({ ms }: { ms: number | null | undefined }) {
  if (!ms) return null;
  const min = Math.round(ms / 60_000);
  return <span> · {min} min</span>;
}

function PlayerName({ p, agent }: { p: ScoreboardPlayer; agent: Agent | undefined }) {
  // Hidden (incognito) players arrive without a name; the client shows the agent instead.
  if (!p.gameName) {
    return <span className="text-muted">{agent?.displayName ?? "Hidden player"} (hidden)</span>;
  }
  return (
    <span className="truncate">
      {p.gameName}
      <span className="text-muted">#{p.tagLine}</span>
    </span>
  );
}

/** Phones: one compact row per player instead of a wide table. */
function TeamList({
  label,
  won,
  roundsWon,
  players,
  agentById,
  myParty,
}: {
  label: string;
  won: boolean;
  roundsWon: number;
  players: ScoreboardPlayer[];
  agentById: Map<string, Agent>;
  myParty: string | null;
}) {
  return (
    <section aria-label={label}>
      <p className="mb-2 flex items-baseline gap-2">
        <span
          className={cn("font-display text-lg font-bold uppercase", won ? "text-win" : "text-loss")}
        >
          {label}
        </span>
        <span className="font-display text-lg font-bold tabular-nums">{roundsWon}</span>
        <span className="ml-auto text-xs uppercase tracking-wider text-muted">ACS · K/D/A</span>
      </p>
      <ol className="divide-y divide-line border-y border-line">
        {players.map((p) => {
          const agent = p.agentId ? agentById.get(p.agentId) : undefined;
          return (
            <li
              key={p.subject}
              className={cn(
                "flex items-center gap-3 py-2 pr-1",
                p.isMe && "bg-raised shadow-[inset_3px_0_0_var(--color-accent)] pl-2",
              )}
            >
              {agent?.displayIconSmall ? (
                <img
                  src={agent.displayIconSmall}
                  alt={agent.displayName}
                  width={40}
                  height={40}
                  className="size-10 shrink-0 bg-bg"
                  loading="lazy"
                />
              ) : (
                <span className="size-10 shrink-0 bg-bg" />
              )}
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-center gap-1.5 text-sm">
                  <PlayerName p={p} agent={agent} />
                  {p.isMe && (
                    <span className="shrink-0 bg-accent px-1 text-[0.6rem] font-bold uppercase text-accent-ink">
                      You
                    </span>
                  )}
                  {!p.isMe && myParty && p.partyId === myParty && (
                    <Users aria-label="In your party" className="size-3.5 shrink-0 text-muted" />
                  )}
                </p>
                <p className="text-xs text-muted tabular-nums">
                  HS {p.headshotRate === null ? "-" : fmtPct(p.headshotRate)} · ADR{" "}
                  {p.adr === null ? "-" : Math.round(p.adr)} · FK {p.firstKills}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-display text-xl font-bold leading-none tabular-nums">
                  {Math.round(p.acs)}
                </p>
                <p className="mt-0.5 text-xs tabular-nums">
                  {p.kills}/{p.deaths}/{p.assists}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function TeamTable({
  label,
  won,
  roundsWon,
  players,
  agentById,
  tiers,
  myParty,
}: {
  label: string;
  won: boolean;
  roundsWon: number;
  players: ScoreboardPlayer[];
  agentById: Map<string, Agent>;
  tiers: Map<number, CompetitiveTier>;
  myParty: string | null;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] table-fixed text-sm">
        <caption className="mb-2 text-left">
          <span
            className={cn(
              "font-display text-lg font-bold uppercase",
              won ? "text-win" : "text-loss",
            )}
          >
            {label}
          </span>
          <span className="ml-2 font-display text-lg font-bold tabular-nums">{roundsWon}</span>
        </caption>
        <colgroup>
          <col className="w-[34%]" />
          <col className="w-16" />
          {Array.from({ length: 8 }, (_, i) => (
            <col key={i} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
            <th scope="col" className="py-2 pr-2 font-semibold">
              Player
            </th>
            <th scope="col" className="px-2 py-2 font-semibold">
              Rank
            </th>
            {["ACS", "K", "D", "A", "+/-", "HS%", "ADR", "FK"].map((h) => (
              <th key={h} scope="col" className="px-2 py-2 text-right font-semibold">
                {h === "FK" ? <abbr title="First kills">FK</abbr> : h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const agent = p.agentId ? agentById.get(p.agentId) : undefined;
            const tier = p.tier ? tiers.get(p.tier) : undefined;
            const diff = p.kills - p.deaths;
            return (
              <tr
                key={p.subject}
                className={cn(
                  "border-b border-line",
                  p.isMe && "bg-raised shadow-[inset_3px_0_0_var(--color-accent)]",
                )}
              >
                <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                  <span className="flex min-w-0 items-center gap-2.5">
                    {agent?.displayIconSmall ? (
                      <img
                        src={agent.displayIconSmall}
                        alt={agent.displayName}
                        width={32}
                        height={32}
                        className="size-8 shrink-0 bg-bg"
                        loading="lazy"
                      />
                    ) : (
                      <span className="size-8 shrink-0 bg-bg" />
                    )}
                    <PlayerName p={p} agent={agent} />
                    {p.isMe && (
                      <span className="shrink-0 bg-accent px-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-accent-ink">
                        You
                      </span>
                    )}
                    {!p.isMe && myParty && p.partyId === myParty && (
                      <Users aria-label="In your party" className="size-3.5 shrink-0 text-muted" />
                    )}
                  </span>
                </th>
                <td className="px-2 py-1.5">
                  {tier?.smallIcon ? (
                    <img
                      src={tier.smallIcon}
                      alt={titleCase(tier.tierName)}
                      title={titleCase(tier.tierName)}
                      width={24}
                      height={24}
                      className="size-6"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                  {Math.round(p.acs)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{p.kills}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{p.deaths}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{p.assists}</td>
                <td
                  className={cn(
                    "px-2 py-1.5 text-right tabular-nums",
                    diff > 0 ? "text-win" : diff < 0 ? "text-loss" : "text-muted",
                  )}
                >
                  {diff > 0 ? `+${diff}` : diff}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {p.headshotRate === null ? "-" : fmtPct(p.headshotRate)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {p.adr === null ? "-" : Math.round(p.adr)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{p.firstKills}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Round-by-round strip, like the client's timeline: green rounds you won, red you lost. */
function RoundStrip({
  rounds,
  myTeamId,
}: {
  rounds: { num: number; winningTeam: string; result: string }[];
  myTeamId: string | null;
}) {
  return (
    <ol aria-label="Rounds" className="flex flex-wrap gap-1">
      {rounds.map((r) => {
        const won = r.winningTeam === myTeamId;
        return (
          <li
            key={r.num}
            className={cn("flex flex-col items-center", r.num === HALF && "ml-3")}
            title={`Round ${r.num + 1}: ${won ? "won" : "lost"}${r.result ? `, ${r.result.toLowerCase()}` : ""}`}
          >
            <span aria-hidden className={cn("h-6 w-3", won ? "bg-win" : "bg-loss/80")} />
            <span className="sr-only">
              Round {r.num + 1}: {won ? "won" : "lost"}
              {r.result ? `, ${r.result.toLowerCase()}` : ""}
            </span>
            <span aria-hidden className="mt-0.5 text-[0.6rem] text-muted tabular-nums">
              {r.num + 1}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function MatchDialog({
  matchId,
  onClose,
  mapByUrl,
  agentById,
  tiers,
}: {
  matchId: string | null;
  onClose: () => void;
  mapByUrl: Map<string, GameMap>;
  agentById: Map<string, Agent>;
  tiers: Map<number, CompetitiveTier>;
}) {
  const session = useActiveSession();
  const phone = useIsPhone();
  const Team = phone ? TeamList : TeamTable;
  const details = useMatchDetails(matchId);
  const puuid = session?.puuid ?? "";
  const board = useMemo(
    () => (details.data ? buildScoreboard(details.data, puuid) : null),
    [details.data, puuid],
  );
  const summary = details.data ? summarizeMatch(details.data, puuid) : null;
  const map = details.data ? mapByUrl.get(details.data.matchInfo.mapId.toLowerCase()) : undefined;
  const myParty = board?.teams[0]?.players.find((p) => p.isMe)?.partyId ?? null;

  return (
    <Dialog open={matchId !== null} onClose={onClose} title="Match details" wide>
      {details.isPending ? (
        <LoadingBlock label="Loading match" />
      ) : details.isError || !board || !details.data ? (
        <ErrorNote title="Couldn't load this match.">Riot didn't return its details.</ErrorNote>
      ) : (
        <div className="space-y-6">
          <div className="relative isolate overflow-hidden bg-bg p-4">
            {map?.listViewIcon && (
              <img
                src={map.listViewIcon}
                alt=""
                className="absolute inset-0 -z-10 size-full object-cover opacity-40"
              />
            )}
            {/* Left scrim keeps the result text readable over the map strip. */}
            <div
              aria-hidden
              className="absolute inset-0 -z-10 bg-gradient-to-r from-bg via-bg/85 to-bg/30"
            />
            {summary && (
              <p
                className={cn(
                  "font-display text-4xl font-bold uppercase leading-none",
                  RESULT_TONE[summary.result],
                )}
              >
                {RESULT_TEXT[summary.result]}
                <span className="ml-3 text-text tabular-nums">
                  {summary.teamScore ?? "-"} : {summary.enemyScore ?? "-"}
                </span>
              </p>
            )}
            <p className="mt-2 text-sm">
              {map?.displayName ?? "Unknown map"}
              <span className="text-muted">
                {" "}
                · {queueName(details.data.matchInfo.queueID)} ·{" "}
                {fmtDateTime(details.data.matchInfo.gameStartMillis)}
                <Duration ms={details.data.matchInfo.gameLengthMillis} />
              </span>
            </p>
            {summary && (
              <p className="mt-1 text-sm text-muted tabular-nums">
                You: {summary.kills} / {summary.deaths} / {summary.assists} ·{" "}
                {fmtDec((summary.kills + summary.assists) / Math.max(1, summary.deaths), 1)} KDA
              </p>
            )}
          </div>

          {board.rounds.length > 0 && (
            <RoundStrip rounds={board.rounds} myTeamId={board.myTeamId} />
          )}

          {board.teams.map((t, i) => (
            <Team
              key={t.teamId}
              label={i === 0 && board.myTeamId ? "Your team" : "Enemy team"}
              won={t.won}
              roundsWon={t.roundsWon}
              players={t.players}
              agentById={agentById}
              tiers={tiers}
              myParty={myParty}
            />
          ))}
          <p className="text-xs text-muted">
            HS% is headshots out of all hits. ADR is average damage per round. FK is first kills,
            the opening kill of a round. Other players' names are never added to share images.
          </p>
        </div>
      )}
    </Dialog>
  );
}
