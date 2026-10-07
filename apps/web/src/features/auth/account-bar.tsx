import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { Dropdown } from "@/components/ui/dropdown";
import { cn } from "@/lib/cn";
import { fmtCountdown } from "@/lib/format";
import { useActiveSession, useSessionStore, type Session } from "./session-store";

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export const accountLabel = (s: Session) =>
  s.demo ? "Demo account" : s.riotId ? `${s.riotId.gameName}#${s.riotId.tagLine}` : "Riot account";

/** Live "expires in mm:ss". Clock icon: it is a countdown. */
export function ExpiryIndicator({ session, className }: { session: Session; className?: string }) {
  const now = useNow();
  if (session.demo) {
    return <span className={cn("text-sm text-muted", className)}>Demo data, no token</span>;
  }
  const left = session.expiresAt - now;
  const soon = left < 5 * 60_000;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm tabular-nums",
        soon ? "text-warn" : "text-muted",
        className,
      )}
      title="Riot access tokens last about an hour. After that you sign in again."
    >
      <Clock aria-hidden className="size-4" />
      <span>
        <span className="sr-only">Sign-in </span>expires in {fmtCountdown(left)}
      </span>
    </span>
  );
}

export function AccountSwitcher() {
  const sessions = useSessionStore((s) => s.sessions);
  const setActive = useSessionStore((s) => s.setActive);
  const active = useActiveSession();
  if (!active) return null;
  if (sessions.length < 2) {
    return (
      <Link to="/settings" className="min-w-0 truncate text-sm font-medium hover:underline">
        {accountLabel(active)}
      </Link>
    );
  }
  return (
    <Dropdown
      label="Active account"
      hideLabel
      size="sm"
      className="w-52"
      value={active.id}
      options={sessions.map((s) => ({ value: s.id, label: accountLabel(s) }))}
      onChange={setActive}
    />
  );
}
