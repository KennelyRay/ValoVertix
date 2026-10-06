import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CompetitiveTier, GameMap } from "@valovertix/assets";
import type { RankPoint } from "@valovertix/calc";
import { fmtDate, fmtDateTime, titleCase } from "@/lib/format";

const tierLabel = (tiers: Map<number, CompetitiveTier>, tier: number) =>
  titleCase(tiers.get(tier)?.tierName ?? `Tier ${tier}`);

/**
 * Answers "how has my rank moved over my last ranked games?".
 * One series, so no legend; the title names it. A table view carries the same data.
 */
export function RankChart({
  points,
  tiers,
  mapByUrl,
}: {
  points: RankPoint[];
  tiers: Map<number, CompetitiveTier>;
  mapByUrl: Map<string, GameMap>;
}) {
  const [asTable, setAsTable] = useState(false);
  const minTier = Math.min(...points.map((p) => p.tier));
  const maxTier = Math.max(...points.map((p) => p.tier));
  const ticks = Array.from({ length: maxTier - minTier + 2 }, (_, i) => (minTier + i) * 100);
  const data = points.map((p, i) => ({ ...p, game: i + 1 }));

  return (
    <div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          className="inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4 hover:text-text"
        >
          {asTable ? "Show chart" : "Show as table"}
        </button>
      </div>
      {asTable ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Rank after each ranked game, oldest first</caption>
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Date
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Map
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Rank
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  RR change
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.matchId} className="border-b border-line">
                  <td className="py-1.5 pr-3">{fmtDate(p.time)}</td>
                  <td className="py-1.5 pr-3">
                    {mapByUrl.get(p.mapId.toLowerCase())?.displayName ?? "Unknown"}
                  </td>
                  <td className="py-1.5 pr-3">
                    {tierLabel(tiers, p.tier)}, {p.rr} RR
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {p.delta > 0 ? `+${p.delta}` : p.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="h-64"
          role="img"
          aria-label={`Rank history over ${points.length} ranked games, from ${tierLabel(tiers, points[0]!.tier)} to ${tierLabel(tiers, points[points.length - 1]!.tier)}. Use "Show as table" for each game.`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="var(--color-line)" vertical={false} />
              <XAxis
                dataKey="game"
                tick={{ fill: "var(--color-muted)", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-line-strong)" }}
                label={{
                  value: "Ranked games, oldest to newest",
                  position: "insideBottom",
                  offset: -2,
                  fill: "var(--color-faint)",
                  fontSize: 11,
                }}
                height={36}
              />
              <YAxis
                domain={[minTier * 100, (maxTier + 1) * 100]}
                ticks={ticks}
                tickFormatter={(v: number) => tierLabel(tiers, Math.round(v / 100))}
                tick={{ fill: "var(--color-muted)", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={86}
              />
              <Tooltip
                cursor={{ stroke: "var(--color-line-strong)" }}
                content={({ active, payload }) => {
                  const p = active
                    ? (payload?.[0]?.payload as (RankPoint & { game: number }) | undefined)
                    : undefined;
                  if (!p) return null;
                  return (
                    <div className="border border-line-strong bg-raised px-3 py-2 text-sm shadow-xl shadow-black/50">
                      <p className="font-medium">
                        {tierLabel(tiers, p.tier)}, {p.rr} RR
                      </p>
                      <p className="text-muted">
                        {p.delta > 0 ? `+${p.delta}` : p.delta} RR on{" "}
                        {mapByUrl.get(p.mapId.toLowerCase())?.displayName ?? "an unknown map"}
                      </p>
                      <p className="text-muted">{fmtDateTime(p.time)}</p>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-text)"
                strokeWidth={2}
                dot={{
                  r: 4,
                  fill: "var(--color-text)",
                  stroke: "var(--color-surface)",
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 6,
                  fill: "var(--color-accent)",
                  stroke: "var(--color-surface)",
                  strokeWidth: 2,
                }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
