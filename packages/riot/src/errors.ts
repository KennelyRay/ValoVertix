import type { DriftIssue } from "./drift";

export type RiotErrorKind =
  | "auth" // 401, or a token Riot no longer accepts
  | "forbidden" // 403
  | "not_found" // 404, often a wrong region
  | "rate_limit" // 429
  | "server" // 5xx or maintenance
  | "bad_request" // other 4xx
  | "network" // fetch failed (offline, DNS, or a CORS-hidden error)
  | "schema"; // response didn't match the expected shape

/**
 * Error messages carry an endpoint label ("store.offers"), never a URL,
 * because pd URLs contain the PUUID.
 */
export class RiotApiError extends Error {
  readonly kind: RiotErrorKind;
  readonly endpoint: string;
  readonly status: number | undefined;
  readonly retryAfterMs: number | undefined;
  readonly issues: DriftIssue[] | undefined;

  constructor(
    kind: RiotErrorKind,
    endpoint: string,
    opts: { status?: number; retryAfterMs?: number; issues?: DriftIssue[] } = {},
  ) {
    super(`${endpoint}: ${kind}${opts.status ? ` (${opts.status})` : ""}`);
    this.name = "RiotApiError";
    this.kind = kind;
    this.endpoint = endpoint;
    this.status = opts.status;
    this.retryAfterMs = opts.retryAfterMs;
    this.issues = opts.issues;
  }
}

export const isRiotError = (e: unknown): e is RiotApiError => e instanceof RiotApiError;

export function kindForStatus(status: number): RiotErrorKind {
  if (status === 401) return "auth";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server";
  return "bad_request";
}

/** Parses Retry-After (seconds or HTTP date) into milliseconds. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}
