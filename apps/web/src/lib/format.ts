import { formatMoneyRange, type MoneyRange } from "@valovertix/calc";

const LOCALE = "en-PH";

export const fmtInt = (n: number) => new Intl.NumberFormat(LOCALE).format(Math.round(n));
export const fmtVp = (n: number) => `${fmtInt(n)} VP`;
export const fmtPct = (ratio: number) =>
  new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 0 }).format(ratio);
export const fmtDec = (n: number, digits = 2) =>
  new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);

export const fmtMoney = (range: MoneyRange, format: { locale: string; currency: string }) =>
  formatMoneyRange(range, format);

/** "mm:ss" under an hour, "h:mm:ss" above, "expired" at zero. */
export function fmtCountdown(ms: number): string {
  if (ms <= 0) return "expired";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (v: number) => String(v).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export const fmtDate = (ms: number) =>
  new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric" }).format(ms);

export const fmtDateTime = (ms: number) =>
  new Intl.DateTimeFormat(LOCALE, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(ms);

/** "IRON 1" -> "Iron 1" */
export const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/** valorant-api colors are RRGGBBAA without '#'. */
export const apiColor = (rrggbbaa: string | null | undefined) =>
  rrggbbaa ? `#${rrggbbaa.slice(0, 6)}` : undefined;

const QUEUE_NAMES: Record<string, string> = {
  competitive: "Competitive",
  unrated: "Unrated",
  swiftplay: "Swiftplay",
  spikerush: "Spike Rush",
  deathmatch: "Deathmatch",
  ggteam: "Escalation",
  hurm: "Team Deathmatch",
  premier: "Premier",
  onefa: "Replication",
  snowball: "Snowball Fight",
  newmap: "New Map",
  "": "Custom",
};
export const queueName = (id: string) => QUEUE_NAMES[id] ?? titleCase(id);
