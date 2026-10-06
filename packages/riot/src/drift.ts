import type { z } from "zod";

/**
 * A schema mismatch with every value stripped out. Only the path shape and
 * the zod issue code remain, so it is safe to log.
 */
export interface DriftIssue {
  source: string;
  path: string;
  code: string;
}

type DriftListener = (issues: DriftIssue[]) => void;
const listeners = new Set<DriftListener>();

export function onSchemaDrift(listener: DriftListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Replaces UUIDs and long digit runs in record keys so IDs never leak into logs. */
const scrubKey = (key: PropertyKey) => {
  if (typeof key === "number") return "[n]";
  const s = String(key);
  if (/^[0-9a-f-]{20,}$/i.test(s) || /^\d{6,}$/.test(s)) return "{id}";
  return s;
};

export function sanitizeIssues(source: string, issues: readonly z.core.$ZodIssue[]): DriftIssue[] {
  return issues.slice(0, 10).map((issue) => ({
    source,
    path: issue.path.map(scrubKey).join(".") || "(root)",
    code: issue.code,
  }));
}

export function reportDrift(issues: DriftIssue[]) {
  if (issues.length === 0) return;
  console.warn(
    "[ValoVertix] Response shape changed:",
    issues.map((i) => `${i.source} ${i.path} (${i.code})`).join("; "),
  );
  for (const listener of listeners) listener(issues);
}
