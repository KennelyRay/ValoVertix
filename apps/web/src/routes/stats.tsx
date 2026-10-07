import { useMemo, useState } from "react";
import { m } from "framer-motion";
import type { Agent, CompetitiveTier, GameMap } from "@valovertix/assets";
import {
  acs,
  headshotRate,
  kda,
  type ActRecord,
  type GroupStats,
  type MatchSummary,
} from "@valovertix/calc";
import { LoadingBlock, PageHeader, RequireSession } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { EmptyNote, ErrorNote, Panel, Skeleton, Tabs } from "@/components/ui/primitives";
import { MATCH_DETAILS_PAGE } from "@/config/app";
import { useMatchStats, useRanks, useStatic } from "@/features/data";
import { MatchDialog } from "@/features/stats/match-dialog";
import { RankChart } from "@/features/stats/rank-chart";
import { SessionCard } from "@/features/stats/session-card";
import { cn } from "@/lib/cn";
import { apiColor, fmtDateTime, fmtDec, fmtPct, queueName, titleCase } from "@/lib/format";

const EYEBROW = "text-xs font-semibold uppercase tracking-[0.2em] text-muted";

const tierName = (tiers: Map<number, CompetitiveTier>, tier: number | null | undefined) => {
  const info = tier ? tiers.get(tier) : undefined;
  return info ? titleCase(info.tierName) : tier ? `Tier ${tier}` : "Unranked";
};

const RESULT_TEXT = { win: "Victory", loss: "Defeat", draw: "Draw" } as const;
const RESULT_TONE = { win: "text-win", loss: "text-loss", draw: "text-muted" } as const;
const RESULT_EDGE = { win: "bg-win", loss: "bg-loss", draw: "bg-line-strong" } as const;

/** Rank rating bar. Immortal and up can pass 100 RR, so the bar caps but the number doesn't. */
function RrBar({ rr }: { rr: number }) {
  return (
    <div className="mt-4 max-w-xs">
      <div className="flex items-baseline justify-between">
        <span className={EYEBROW}>Rank rating</span>
        <span className="font-display text-lg font-bold tabular-nums">
          {rr}
          <span className="text-sm text-muted"> / 100</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label="Rank rating"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(rr, 100)}
        className="mt-1.5 h-1.5 bg-line"
      >
        <m.div
          className="h-full origin-left bg-accent"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: Math.min(rr, 100) / 100 }}
          transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </div>
    </div>
  );
}

/**
 * The act-rank triangle from the client: the act's nine best wins, highest at the top,
 * in rows of 1, 3 and 5. Empty slots stay outlined.
 */
function ActTriangle({ act, tiers }: { act: ActRecord; tiers: Map<number, CompetitiveTier> }) {
  const S = 30; // triangle side
  const H = S * 0.866;
  const slots: { points: string; tier: number | undefined }[] = [];
  let n = 0;
  for (let row = 0; row < 3; row++) {
    const left = (2 - row) * (S / 2);
    for (let j = 0; j < row * 2 + 1; j++) {
      const x = left + (j * S) / 2;
      const y = row * H;
      const up = j % 2 === 0;
      const points = up
        ? `${x},${y + H} ${x + S / 2},${y} ${x + S},${y + H}`
        : `${x},${y} ${x + S},${y} ${x + S / 2},${y + H}`;
      slots.push({ points, tier: act.winTiers[n++] });
    }
  }
  const best = act.winTiers[0];
  return (
    <svg
      role="img"
      aria-label={
        best
          ? `Act rank: your best ${Math.min(act.winTiers.length, 9)} wins, highest at ${tierName(tiers, best)}`
          : "Act rank: no wins yet this act"
      }
      viewBox={`-2 -2 ${S * 3 + 4} ${H * 3 + 4}`}
      className="h-auto w-36"
    >
      {slots.map((s, i) => {
        const color = s.tier ? apiColor(tiers.get(s.tier)?.color) : undefined;
        return (
          <polygon
            key={i}
            points={s.points}
            fill={color ?? "transparent"}
            stroke={color ? "var(--color-bg)" : "var(--color-line-strong)"}
            strokeWidth={color ? 2.5 : 1}
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}

function RankHero() {
  const { mmr, tiers, current, peak, act } = useRanks();
  const info = current?.tier ? tiers.get(current.tier) : undefined;
  const peakInfo = peak?.tier ? tiers.get(peak.tier) : undefined;
  const glow = apiColor(info?.color) ?? "var(--color-line-strong)";

  return (
    <Panel aria-labelledby="rank-title" className="panel-raised relative overflow-hidden">
      {/* Decorative tier-colored glow; text sits on the solid panel fill beside it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 size-96 opacity-25 blur-3xl"
        style={{ background: `radial-gradient(circle, ${glow}, transparent 70%)` }}
      />
      <h2 id="rank-title" className={cn(EYEBROW, "relative")}>
        Competitive
      </h2>
      {mmr.isPending ? (
        <LoadingBlock label="Loading rank" className="mt-4" />
      ) : mmr.isError ? (
        <p className="mt-3 text-sm text-muted">Couldn't load your rank from Riot.</p>
      ) : (
        <div className="relative mt-3 grid items-center gap-8 md:grid-cols-[1fr_auto_auto]">
          <div className="flex items-center gap-5">
            {info?.largeIcon ? (
              <img
                src={info.largeIcon}
                alt=""
                width={112}
                height={112}
                className="size-24 shrink-0 drop-shadow-[0_0_24px_rgba(0,0,0,0.5)] sm:size-28"
                decoding="async"
              />
            ) : (
              <span
                aria-hidden
                className="size-24 shrink-0 border border-dashed border-line-strong sm:size-28"
              />
            )}
            <div className="min-w-0">
              <p className={EYEBROW}>Current rank</p>
              <p className="font-display text-4xl font-bold uppercase leading-none tracking-tight sm:text-5xl">
                {tierName(tiers, current?.tier)}
              </p>
              {current?.tier ? <RrBar rr={current.rr} /> : null}
            </div>
          </div>

          <div className="flex items-center gap-3 border-line md:border-l md:pl-8">
            {peakInfo?.smallIcon ? (
              <img
                src={peakInfo.smallIcon}
                alt=""
                width={48}
                height={48}
                className="size-12 shrink-0"
                loading="lazy"
              />
            ) : null}
            <div>
              <p className={EYEBROW}>Peak rank</p>
              <p className="font-display text-2xl font-bold uppercase leading-tight">
                {tierName(tiers, peak?.tier)}
              </p>
            </div>
          </div>

          {act && (
            <div className="flex items-center gap-4 border-line md:border-l md:pl-8">
              <ActTriangle act={act} tiers={tiers} />
              <div>
                <p className={EYEBROW}>Act rank</p>
                <p className="font-display text-2xl font-bold uppercase leading-tight">
                  {tierName(tiers, act.winTiers[0])}
                </p>
                <p className="text-sm text-muted tabular-nums">
                  {act.wins} wins{act.games ? ` in ${act.games} games` : ""}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function StatCell({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border-line py-3 sm:border-l sm:px-4 sm:first:border-l-0 sm:first:pl-0">
      <dt className={EYEBROW}>{label}</dt>
      <dd className="mt-1 font-display text-3xl font-bold tabular-nums leading-none">{value}</dd>
      {note && <dd className="mt-1 text-sm text-muted tabular-nums">{note}</dd>}
    </div>
  );
}

/** Last results as a row of squares, oldest on the left, like the client's form strip. */
function FormStrip({ summaries }: { summaries: MatchSummary[] }) {
  const recent = summaries.slice(0, 10).reverse();
  return (
    <div className="flex items-center gap-1" aria-hidden>
      {recent.map((s) => (
        <span key={s.matchId} className={cn("h-5 w-2", RESULT_EDGE[s.result])} />
      ))}
    </div>
  );
}

function MatchRow({
  s,
  map,
  agent,
  onOpen,
}: {
  s: MatchSummary;
  map: GameMap | undefined;
  agent: Agent | undefined;
  onOpen: () => void;
}) {
  const matchAcs = s.roundsPlayed ? Math.round(s.score / s.roundsPlayed) : null;
  const hs = s.combat ? headshotRate(s.combat) : null;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        className="group relative flex min-h-16 w-full items-center overflow-hidden bg-surface text-left transition-colors hover:bg-raised"
      >
        {map?.listViewIcon && (
          // Map strip faded behind a gradient so the stats over it keep full contrast.
          <img
            src={map.listViewIcon}
            alt=""
            className="pointer-events-none absolute inset-y-0 right-0 h-full w-2/3 object-cover opacity-40 transition-opacity group-hover:opacity-60"
            loading="lazy"
          />
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-surface from-35% to-surface/60 group-hover:from-raised group-hover:to-raised/50"
        />
        <span aria-hidden className={cn("relative w-1 self-stretch", RESULT_EDGE[s.result])} />
        <div className="relative flex flex-1 flex-wrap items-center gap-x-5 gap-y-1 px-3 py-2 sm:flex-nowrap">
          {agent?.displayIconSmall ? (
            <img
              src={agent.displayIconSmall}
              alt={agent.displayName}
              width={44}
              height={44}
              className="size-11 shrink-0 bg-raised"
              loading="lazy"
            />
          ) : (
            <span className="size-11 shrink-0 bg-raised" />
          )}
          <div className="w-44 min-w-0">
            <p
              className={cn(
                "font-display text-xl font-bold uppercase leading-none",
                RESULT_TONE[s.result],
              )}
            >
              {RESULT_TEXT[s.result]}
            </p>
            <p className="mt-1 truncate text-sm">
              {map?.displayName ?? "Unknown map"}
              <span className="text-muted"> · {queueName(s.queueId)}</span>
            </p>
          </div>
          <p className="w-20 font-display text-2xl font-bold tabular-nums">
            {s.teamScore ?? "-"}
            <span className="text-muted"> : </span>
            {s.enemyScore ?? "-"}
          </p>
          <div className="w-28">
            <p className="font-semibold tabular-nums">
              {s.kills} / {s.deaths} / {s.assists}
            </p>
            <p className="text-xs uppercase tracking-wider text-muted">
              KDA {fmtDec(kda(s.kills, s.deaths, s.assists), 1)}
            </p>
          </div>
          <div className="w-16">
            <p className="font-semibold tabular-nums">{matchAcs ?? "-"}</p>
            <p className="text-xs uppercase tracking-wider text-muted">ACS</p>
          </div>
          <div className="hidden w-16 md:block">
            <p className="font-semibold tabular-nums">{hs === null ? "-" : fmtPct(hs)}</p>
            <p className="text-xs uppercase tracking-wider text-muted">HS%</p>
          </div>
          <p className="ml-auto text-right text-sm text-muted">{fmtDateTime(s.startedAt)}</p>
        </div>
      </button>
    </li>
  );
}

function WeaponList({
  rows,
  weaponById,
}: {
  rows: { key: string; kills: number }[];
  weaponById: Map<string, { displayName: string; displayIcon: string | null }>;
}) {
  if (!rows.length) {
    return <p className="text-sm text-muted">No weapon kills in the loaded matches.</p>;
  }
  const total = rows.reduce((s, r) => s + r.kills, 0);
  const max = rows[0]!.kills;
  return (
    <ol className="grid gap-2 sm:grid-cols-2" aria-label="Kills by weapon">
      {rows.map((r, i) => {
        const w = weaponById.get(r.key);
        return (
          <li key={r.key} className="flex items-center gap-4 bg-surface px-4 py-3">
            <span className="w-5 font-display text-lg font-bold text-muted tabular-nums">
              {i + 1}
            </span>
            <div className="flex h-10 w-28 shrink-0 items-center justify-center">
              {w?.displayIcon && (
                <img
                  src={w.displayIcon}
                  alt=""
                  loading="lazy"
                  className="max-h-10 w-auto max-w-full object-contain"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline justify-between gap-2">
                <span className="truncate font-display text-lg font-bold uppercase">
                  {w?.displayName ?? "Unknown weapon"}
                </span>
                <span className="shrink-0 text-sm tabular-nums">
                  {r.kills} {r.kills === 1 ? "kill" : "kills"}
                  <span className="text-muted"> · {fmtPct(r.kills / total)}</span>
                </span>
              </p>
              <div aria-hidden className="mt-1.5 h-1 bg-line">
                <div className="h-full bg-accent" style={{ width: `${(r.kills / max) * 100}%` }} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function WinBar({ rate }: { rate: number }) {
  return (
    <div aria-hidden className="mt-2 h-1 bg-line">
      <div className="h-full bg-win" style={{ width: `${Math.round(rate * 100)}%` }} />
    </div>
  );
}

function AgentCards({ rows, agentById }: { rows: GroupStats[]; agentById: Map<string, Agent> }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((a) => {
        const agent = agentById.get(a.key);
        return (
          <li key={a.key} className="hud-corners flex items-center gap-4 bg-surface p-3">
            {agent?.displayIcon ? (
              <img
                src={agent.displayIcon}
                alt=""
                width={64}
                height={64}
                className="size-16 shrink-0 bg-raised"
                loading="lazy"
              />
            ) : (
              <span className="size-16 shrink-0 bg-raised" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-xl font-bold uppercase leading-none">
                {agent?.displayName ?? "Unknown agent"}
              </p>
              {agent?.role && <p className="text-xs text-muted">{agent.role.displayName}</p>}
              <p className="mt-1.5 text-sm tabular-nums">
                {a.games} {a.games === 1 ? "game" : "games"}
                <span className="text-muted"> · </span>
                {fmtPct(a.winRate)} win
                <span className="text-muted"> · </span>
                {fmtDec(a.kda, 1)} KDA
              </p>
              <WinBar rate={a.winRate} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MapCards({ rows, mapByUrl }: { rows: GroupStats[]; mapByUrl: Map<string, GameMap> }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => {
        const map = mapByUrl.get(r.key.toLowerCase());
        return (
          <li key={r.key} className="relative isolate overflow-hidden bg-surface">
            {map?.splash && (
              <img
                src={map.splash}
                alt=""
                className="absolute inset-0 -z-10 size-full object-cover opacity-80"
                loading="lazy"
              />
            )}
            {/* Bottom scrim: the text band sits on 90%+ background, so it stays above 4.5:1 on any splash. */}
            <div
              aria-hidden
              className="absolute inset-0 -z-10 bg-gradient-to-t from-bg from-40% via-bg/60 to-bg/0"
            />
            <div className="flex min-h-32 flex-col justify-end p-4">
              <p className="font-display text-2xl font-bold uppercase leading-none">
                {map?.displayName ?? "Unknown map"}
              </p>
              <p className="mt-1 text-sm tabular-nums">
                {fmtPct(r.winRate)} win
                <span className="text-muted">
                  {" "}
                  · {r.wins}W {r.games - r.wins}L
                </span>
              </p>
              <WinBar rate={r.winRate} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function RankHistory() {
  const { updates, tiers, history } = useRanks();
  const { mapByUrl } = useMatchStats(0);
  return (
    <section aria-labelledby="history-title">
      <h3 id="history-title" className="text-lg">
        Rank over your last {history.length || ""} ranked games
      </h3>
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
    </section>
  );
}

function Session() {
  const { history, tiers } = useRanks();
  const { mapByUrl } = useMatchStats(0);
  return history.length ? (
    <SessionCard history={history} tiers={tiers} mapByUrl={mapByUrl} />
  ) : null;
}

type Tab = "matches" | "agents" | "weapons" | "maps" | "rank";

function Career() {
  const [count, setCount] = useState(MATCH_DETAILS_PAGE);
  const [tab, setTab] = useState<Tab>("matches");
  const [openMatch, setOpenMatch] = useState<string | null>(null);
  const { history, ids, details, aggregate, mapByUrl, agentById } = useMatchStats(count);
  const { tiers } = useRanks();
  const weapons = useStatic("weapons");
  const weaponById = useMemo(
    () => new Map((weapons.data ?? []).map((w) => [w.uuid.toLowerCase(), w])),
    [weapons.data],
  );

  if (history.isPending) return <LoadingBlock label="Loading match history" />;
  if (history.isError) {
    return (
      <>
        <ErrorNote title="Match history is unavailable right now.">
          Riot didn't return your recent matches. Rank data above may still be accurate.
        </ErrorNote>
        <Panel>
          <RankHistory />
        </Panel>
      </>
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
  const kd = aggregate.deaths ? aggregate.kills / aggregate.deaths : aggregate.kills;
  return (
    <>
      <Panel aria-labelledby="agg-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="agg-title" className={EYEBROW}>
            Across your last {loaded} loaded matches
          </h2>
          {loaded > 0 && <FormStrip summaries={details.summaries} />}
        </div>
        {loaded === 0 ? (
          <LoadingBlock label="Loading match details" className="mt-4" />
        ) : (
          <dl className="mt-3 grid grid-cols-2 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatCell
              label="Win rate"
              value={fmtPct(aggregate.winRate)}
              note={`${aggregate.wins}W ${aggregate.losses}L${aggregate.draws ? ` ${aggregate.draws}D` : ""}`}
            />
            <StatCell
              label="K/D"
              value={fmtDec(kd)}
              note={`KDA ${fmtDec(aggregate.kda)} · ${aggregate.kills}/${aggregate.deaths}/${aggregate.assists}`}
            />
            <StatCell label="ACS" value={String(Math.round(acs(details.summaries)))} />
            <StatCell
              label="Headshot %"
              value={aggregate.headshotRate === null ? "-" : fmtPct(aggregate.headshotRate)}
              note="Of all hits"
            />
            <StatCell
              label="ADR"
              value={aggregate.adr === null ? "-" : String(Math.round(aggregate.adr))}
              note="Damage per round"
            />
            <StatCell
              label="First bloods"
              value={String(aggregate.firstKills)}
              note={`${aggregate.firstDeaths} first deaths`}
            />
          </dl>
        )}
      </Panel>

      <div>
        <Tabs<Tab>
          label="Stats sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "matches", label: "Match history" },
            { id: "agents", label: "Agents" },
            { id: "weapons", label: "Weapons" },
            { id: "maps", label: "Maps" },
            { id: "rank", label: "Rank history" },
          ]}
        />
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-4">
          {tab === "matches" && (
            <>
              <ul className="space-y-1.5" aria-label="Recent matches">
                {details.results.map((r, i) => {
                  const id = ids[i]!;
                  const s = details.summaries.find((x) => x.matchId === id);
                  if (r.isPending) {
                    return (
                      <li key={id} aria-busy>
                        <Skeleton className="h-16 w-full" />
                      </li>
                    );
                  }
                  if (!s) {
                    return (
                      <li key={id} className="bg-surface px-4 py-3 text-sm text-muted">
                        Couldn't load this match.
                      </li>
                    );
                  }
                  return (
                    <MatchRow
                      key={id}
                      s={s}
                      map={mapByUrl.get(s.mapId.toLowerCase())}
                      agent={s.agentId ? agentById.get(s.agentId) : undefined}
                      onOpen={() => setOpenMatch(id)}
                    />
                  );
                })}
              </ul>
              {details.loading === 0 && count < ids.length && (
                <Button className="mt-4" onClick={() => setCount((c) => c + MATCH_DETAILS_PAGE)}>
                  Load {Math.min(MATCH_DETAILS_PAGE, ids.length - count)} more matches
                </Button>
              )}
            </>
          )}
          {tab === "agents" && <AgentCards rows={aggregate.agents} agentById={agentById} />}
          {tab === "weapons" && <WeaponList rows={aggregate.weapons} weaponById={weaponById} />}
          {tab === "maps" && <MapCards rows={aggregate.maps} mapByUrl={mapByUrl} />}
          {tab === "rank" && <RankHistory />}
        </div>
        <MatchDialog
          matchId={openMatch}
          onClose={() => setOpenMatch(null)}
          mapByUrl={mapByUrl}
          agentById={agentById}
          tiers={tiers}
        />
      </div>
    </>
  );
}

export default function StatsRoute() {
  return (
    <RequireSession title="Stats">
      <PageHeader title="Stats">
        Rank, ranked history and your recent matches, straight from Riot.
      </PageHeader>
      <div className="reveal-children space-y-6">
        <RankHero />
        <Session />
        <Career />
      </div>
    </RequireSession>
  );
}
