import type { CompetitiveTier, GameMap } from "@valovertix/assets";
import { rankedSession, type RankPoint } from "@valovertix/calc";
import { Panel } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { fmtDate, titleCase } from "@/lib/format";

const EYEBROW = "text-xs font-semibold uppercase tracking-[0.2em] text-muted";

const isToday = (ms: number, now: number) =>
  new Date(ms).toDateString() === new Date(now).toDateString();
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** The latest run of ranked games: net RR, W/L and each game's RR change. */
export function SessionCard({
  history,
  tiers,
  mapByUrl,
  now = Date.now(),
}: {
  history: RankPoint[];
  tiers: Map<number, CompetitiveTier>;
  mapByUrl: Map<string, GameMap>;
  now?: number;
}) {
  const session = rankedSession(history);
  if (!session) return null;
  const tierName = (t: number) => titleCase(tiers.get(t)?.tierName ?? `Tier ${t}`);
  const title = isToday(session.endedAt, now)
    ? "Today's ranked session"
    : `Last ranked session · ${fmtDate(session.endedAt)}`;
  const games = [...session.games].reverse();
  const changed = session.before && session.before.tier !== session.after.tier;

  return (
    <Panel aria-labelledby="session-title">
      <h2 id="session-title" className={EYEBROW}>
        {title}
      </h2>
      <div className="mt-3 flex flex-wrap items-end gap-x-10 gap-y-4">
        <div>
          <p
            className={cn(
              "font-display text-5xl font-bold leading-none tabular-nums",
              session.net > 0 ? "text-win" : session.net < 0 ? "text-loss" : "text-text",
            )}
          >
            {signed(session.net)} RR
          </p>
          <p className="mt-1 text-sm text-muted tabular-nums">
            {session.wins}W {session.losses}L{session.draws ? ` ${session.draws}D` : ""} over{" "}
            {session.games.length} {session.games.length === 1 ? "game" : "games"}
          </p>
        </div>
        <div>
          <p className={EYEBROW}>Rank</p>
          <p className="mt-1 font-display text-xl font-bold uppercase">
            {changed && session.before ? (
              <>
                {tierName(session.before.tier)}
                <span className="text-muted"> to </span>
                {tierName(session.after.tier)}
              </>
            ) : (
              tierName(session.after.tier)
            )}
            <span className="ml-2 text-base text-muted tabular-nums">{session.after.rr} RR</span>
          </p>
        </div>
        <ol aria-label="RR change per game, oldest first" className="flex flex-wrap gap-1.5">
          {games.map((g) => (
            <li
              key={g.matchId}
              title={mapByUrl.get(g.mapId.toLowerCase())?.displayName}
              className={cn(
                "min-w-12 border-b-2 bg-raised px-2 py-1 text-center text-sm font-semibold tabular-nums",
                g.delta > 0
                  ? "border-win text-win"
                  : g.delta < 0
                    ? "border-loss text-loss"
                    : "border-line-strong",
              )}
            >
              {signed(g.delta)}
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-3 text-xs text-muted">
        Games played within three hours of each other count as one session. Wins and losses are read
        from the RR change.
      </p>
    </Panel>
  );
}
