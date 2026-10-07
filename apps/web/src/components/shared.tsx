import { useState, type ReactNode } from "react";
import { m } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import type { CompetitiveTier } from "@valovertix/assets";
import { useActiveSession, useSessionStore } from "@/features/auth/session-store";
import { startDemo } from "@/features/auth/actions";
import { cn } from "@/lib/cn";
import { titleCase } from "@/lib/format";
import { DataFreshness } from "@/features/data-freshness";
import { SignedOut } from "./signed-out";
import { toast } from "./toast";
import { Button } from "./ui/button";

export function PageHeader({
  title,
  children,
  actions,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-4xl sm:text-5xl">{title}</h1>
        {children && <div className="mt-1 max-w-2xl text-muted">{children}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {actions}
        <DataFreshness />
      </div>
    </div>
  );
}

export function DemoButton({
  variant = "secondary",
  label = "Try the demo account",
  className,
}: {
  variant?: "primary" | "secondary" | "ghost";
  label?: string;
  /** Replaces the standard button styling (e.g. the landing page's framed buttons). */
  className?: string;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    setBusy(true);
    try {
      await startDemo();
      void navigate({ to: "/dashboard" });
    } catch {
      toast.error("The demo needs service workers, which this browser has blocked.");
    } finally {
      setBusy(false);
    }
  };
  const text = busy ? "Loading demo…" : label;
  return className ? (
    <button type="button" className={className} disabled={busy} onClick={onClick}>
      {text}
    </button>
  ) : (
    <Button variant={variant} disabled={busy} onClick={onClick}>
      {text}
    </Button>
  );
}

/** Wraps app pages: shows sign-in when no account is connected. */
export function RequireSession({ title, children }: { title: string; children: ReactNode }) {
  const session = useActiveSession();
  const booting = useSessionStore((s) => s.booting);
  if (session) return <>{children}</>;
  if (booting) return <LoadingBlock label={`Loading ${title}`} className="py-6" />;
  return <SignedOut title={title} />;
}

export function StatTile({
  label,
  value,
  note,
  className,
  emphasis = false,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  className?: string;
  emphasis?: boolean;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-sm text-muted">{label}</dt>
      <dd
        className={cn(
          "font-display font-bold leading-tight tabular-nums",
          emphasis ? "text-4xl sm:text-5xl" : "text-3xl",
        )}
      >
        {value}
      </dd>
      {note && <dd className="mt-0.5 text-sm text-muted">{note}</dd>}
    </div>
  );
}

/**
 * Horizontal bars as plain HTML: every value is printed, so the chart is its
 * own table. Bars animate width only, so a toggle (e.g. agents) shows the shift.
 */
export function BarList({
  rows,
  formatValue,
  label,
  max: maxOverride,
}: {
  rows: {
    key: string;
    label: ReactNode;
    value: number;
    sub?: ReactNode;
    color?: string | undefined;
  }[];
  formatValue: (v: number) => string;
  label: string;
  max?: number;
}) {
  const max = maxOverride ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul aria-label={label} className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums">
              {formatValue(r.value)}
              {r.sub && <span className="ml-2 text-muted">{r.sub}</span>}
            </span>
          </div>
          <div className="mt-1 h-2 bg-raised" aria-hidden>
            <m.div
              className="h-full rounded-r-[4px]"
              style={{ backgroundColor: r.color ?? "var(--color-muted)" }}
              initial={false}
              animate={{ width: `${(r.value / max) * 100}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function RankBadge({
  tier,
  rr,
  tiers,
  size = "md",
}: {
  tier: number | null | undefined;
  rr?: number | null;
  tiers: Map<number, CompetitiveTier>;
  size?: "md" | "lg";
}) {
  const info = tier != null ? tiers.get(tier) : undefined;
  const name = info ? titleCase(info.tierName) : tier ? `Tier ${tier}` : "Unranked";
  const icon = info?.largeIcon ?? info?.smallIcon;
  const px = size === "lg" ? 64 : 40;
  return (
    <div className="flex items-center gap-3">
      {icon ? (
        <img
          src={icon}
          alt=""
          width={px}
          height={px}
          className="shrink-0"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span
          aria-hidden
          style={{ width: px, height: px }}
          className="shrink-0 border border-dashed border-line-strong"
        />
      )}
      <div>
        <p
          className={cn(
            "font-display font-bold leading-none",
            size === "lg" ? "text-3xl" : "text-xl",
          )}
        >
          {name}
        </p>
        {rr != null && tier ? <p className="text-sm text-muted tabular-nums">{rr} RR</p> : null}
      </div>
    </div>
  );
}

export function LoadingBlock({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" className={cn("space-y-3", className)}>
      <span className="sr-only">{label}</span>
      <div className="skeleton h-6 w-1/3" />
      <div className="skeleton h-4 w-2/3" />
      <div className="skeleton h-4 w-1/2" />
    </div>
  );
}
