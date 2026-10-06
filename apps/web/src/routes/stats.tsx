import { useState } from "react";
import { kda } from "@valovertix/calc";
import { LoadingBlock, PageHeader, RankBadge, RequireSession, StatTile } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { EmptyNote, ErrorNote, Panel, Skeleton } from "@/components/ui/primitives";
import { MATCH_DETAILS_PAGE } from "@/config/app";
import { useMatchStats, useRanks } from "@/features/data";
import { RankChart } from "@/features/stats/rank-chart";
import { cn } from "@/lib/cn";
import { fmtDateTime, fmtDec, fmtPct, queueName } from "@/lib/format";

function RankPanel() {
  const { mmr, updates, tiers, current, peak, history } = useRanks();
  const { mapByUrl } = useMatchStats(0);
  return (
    <Panel aria-labelledby="rank-title" className="panel-raised">
      <h2 id="rank-title" className="text-xl">
        Competitive rank
      </h2>
      {mmr.isPending ? (
        <LoadingBlock label="Loading rank" className="mt-4" />
      ) : mmr.isError ? (
        <p className="mt-3 text-sm text-muted">Couldn't load your rank from Riot.</p>
      ) : (
        <dl className="mt-4 flex flex-wrap gap-x-12 gap-y-4">
          <div>
            <dt className="mb-1 text-sm text-muted">Current</dt>
            <dd>
              <RankBadge size="lg" tier={current?.tier} rr={current?.rr} tiers={tiers} />
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-sm text-muted">Peak</dt>
            <dd>
              <RankBadge size="lg" tier={peak?.tier} tiers={tiers} />
            </dd>
          </div>
        </dl>
      )}
      <h3 className="mt-6 text-lg">Rank over your last {history.length || ""} ranked games</h3>
      {updates.isPending ? (
        <Skeleton className="mt-3 h-64 w-full" />
      ) : updates.isError ? (
        <p className="mt-2 text-sm text-muted">Couldn't load ranked history.</p>
      ) : history.length < 2 ? (
        <p className="mt-2 text-sm text-muted">
          Not enough ranked games to draw a history yet. Play a couple of competitive matches and
          check back.
        </p>
      ) : (
        <RankChart points={history} tiers={tiers} mapByUrl={mapByUrl} />
      )}
    </Panel>
  );
}

function Matches() {
  const [count, setCount] = useState(MATCH_DETAILS_PAGE);
  const { history, ids, details, aggregate, mapByUrl, agentById } = useMatchStats(count);

  if (history.isPending) return <LoadingBlock label="Loading match history" />;
  if (history.isError) {
    return (
      <ErrorNote title="Match history is unavailable right now.">
        Riot didn't return your recent matches. Rank data above may still be accurate.
      </ErrorNote>
    );
  }
  if (ids.length === 0) {
    return (
      <EmptyNote title="No recent matches">
        Riot only keeps your most recent games here. Play a match and it will show up.
      </EmptyNote>
    );
  }

  const loaded = details.summaries.length;
  return (
    <div className="space-y-6">
      <Panel aria-labelledby="agg-title">
        <h2 id="agg-title" className="text-xl">
          Across your last {loaded} loaded matches
        </h2>
        {loaded === 0 ? (
          <LoadingBlock label="Loading match details" className="mt-4" />
        ) : (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">
              <StatTile
                label="Win rate"
                value={fmtPct(aggregate.winRate)}
                note={`${aggregate.wins}W ${aggregate.losses}L${aggregate.draws ? ` ${aggregate.draws}D` : ""}`}
              />
              <StatTile
                label="KDA"
                value={fmtDec(aggregate.kda)}
                note={`${aggregate.kills} / ${aggregate.deaths} / ${aggregate.assists}`}
              />
              <StatTile
                label="Most played"
                value={agentById.get(aggregate.agents[0]?.key ?? "")?.displayName ?? "None"}
                note={aggregate.agents[0] ? `${aggregate.agents[0].games} games` : undefined}
              />
              <StatTile
                label="Best map"
                value={
                  mapByUrl.get(aggregate.maps[0]?.key.toLowerCase() ?? "")?.displayName ?? "None"
                }
                note={
                  aggregate.maps[0]
                    ? `${fmtPct(aggregate.maps[0].winRate)} over ${aggregate.maps[0].games}`
                    : undefined
                }
              />
            </dl>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-lg">Agents</h3>
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-muted">
                      <th scope="col" className="py-2 font-medium">
                        Agent
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        Games
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        Win
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        KDA
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregate.agents.slice(0, 6).map((a) => {
                      const agent = agentById.get(a.key);
                      return (
                        <tr key={a.key} className="border-b border-line">
                          <td className="py-1.5">
                            <span className="flex items-center gap-2">
                              {agent?.displayIconSmall && (
                                <img
                                  src={agent.displayIconSmall}
                                  alt=""
                                  width={24}
                                  height={24}
                                  className="size-6"
                                  loading="lazy"
                                />
                              )}
                              {agent?.displayName ?? "Unknown agent"}
                            </span>
                          </td>
                          <td className="py-1.5 text-right tabular-nums">{a.games}</td>
                          <td className="py-1.5 text-right tabular-nums">{fmtPct(a.winRate)}</td>
                          <td className="py-1.5 text-right tabular-nums">{fmtDec(a.kda)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div>
                <h3 className="text-lg">Maps, best win rate first</h3>
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-muted">
                      <th scope="col" className="py-2 font-medium">
                        Map
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        Games
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        Win
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregate.maps.slice(0, 6).map((m) => (
                      <tr key={m.key} className="border-b border-line">
                        <td className="py-1.5">
                          {mapByUrl.get(m.key.toLowerCase())?.displayName ?? "Unknown map"}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{m.games}</td>
                        <td className="py-1.5 text-right tabular-nums">{fmtPct(m.winRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </Panel>

      <Panel aria-labelledby="matches-title">
        <h2 id="matches-title" className="text-xl">
          Recent matches
        </h2>
        <ul className="mt-3 divide-y divide-line">
          {details.results.map((r, i) => {
            const id = ids[i]!;
            const s = details.summaries.find((x) => x.matchId === id);
            if (r.isPending) {
              return (
                <li key={id} className="py-3" aria-busy>
                  <Skeleton className="h-10 w-full" />
                </li>
              );
            }
            if (!s) {
              return (
                <li key={id} className="py-3 text-sm text-muted">
                  Couldn't load this match.
                </li>
              );
            }
            const map = mapByUrl.get(s.mapId.toLowerCase());
            const agent = s.agentId ? agentById.get(s.agentId) : undefined;
            const resultLabel = s.result === "win" ? "Win" : s.result === "loss" ? "Loss" : "Draw";
            return (
              <li key={id} className="flex items-center gap-3 py-2.5">
                <span
                  className={cn(
                    "w-12 shrink-0 font-display text-lg font-bold",
                    s.result === "win"
                      ? "text-win"
                      : s.result === "loss"
                        ? "text-loss"
                        : "text-muted",
                  )}
                >
                  {resultLabel}
                </span>
                {agent?.displayIconSmall ? (
                  <img
                    src={agent.displayIconSmall}
                    alt={agent.displayName}
                    width={36}
                    height={36}
                    className="size-9 shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <span className="size-9 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {map?.displayName ?? "Unknown map"}
                    <span className="text-muted"> · {queueName(s.queueId)}</span>
                  </p>
                  <p className="text-sm text-muted">{fmtDateTime(s.startedAt)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-lg font-bold tabular-nums">
                    {s.teamScore ?? "–"} : {s.enemyScore ?? "–"}
                  </p>
                  <p className="text-sm text-muted tabular-nums">
                    {s.kills}/{s.deaths}/{s.assists} ·{" "}
                    {fmtDec(kda(s.kills, s.deaths, s.assists), 1)} KDA
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        {details.loading === 0 && count < ids.length && (
          <Button className="mt-4" onClick={() => setCount((c) => c + MATCH_DETAILS_PAGE)}>
            Load {Math.min(MATCH_DETAILS_PAGE, ids.length - count)} more matches
          </Button>
        )}
      </Panel>
    </div>
  );
}

export default function StatsRoute() {
  return (
    <RequireSession title="Stats">
      <PageHeader title="Stats">
        Rank, ranked history and your recent matches, straight from Riot.
      </PageHeader>
      <div className="space-y-6">
        <RankPanel />
        <Matches />
      </div>
    </RequireSession>
  );
}
