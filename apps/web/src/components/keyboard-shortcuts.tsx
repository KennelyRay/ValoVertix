import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useDataFreshness } from "@/features/data-freshness";
import { Dialog } from "./ui/primitives";

/** "g" then a letter, like many web apps. */
export const GO_TO = [
  { key: "d", to: "/dashboard", label: "Dashboard" },
  { key: "s", to: "/store", label: "Store" },
  { key: "p", to: "/spending", label: "Spending" },
  { key: "t", to: "/stats", label: "Stats" },
  { key: "c", to: "/collection", label: "Collection" },
  { key: "h", to: "/share", label: "Share card" },
  { key: "e", to: "/settings", label: "Settings" },
] as const;

/** Keys never fire while typing, with a modifier held, or inside an open dialog. */
function ignore(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return (
    e.defaultPrevented ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    Boolean(
      el?.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']"),
    ) ||
    Boolean(el?.closest("dialog[open]")) ||
    Boolean(el?.closest("[role='combobox'], [role='listbox']"))
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-7 items-center justify-center border border-line-strong bg-bg px-1.5 py-0.5 font-display text-sm font-semibold">
      {children}
    </kbd>
  );
}

export function KeyboardShortcuts({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { session, refresh } = useDataFreshness();
  const pendingG = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ignore(e)) return;
      const key = e.key.toLowerCase();
      if (pendingG.current !== null) {
        window.clearTimeout(pendingG.current);
        pendingG.current = null;
        const target = GO_TO.find((g) => g.key === key);
        if (target) {
          e.preventDefault();
          void navigate({ to: target.to });
        }
        return;
      }
      if (key === "g") {
        pendingG.current = window.setTimeout(() => (pendingG.current = null), 1500);
      } else if (e.key === "?") {
        e.preventDefault();
        setOpen(true);
      } else if (key === "r" && session) {
        e.preventDefault();
        void refresh();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, refresh, session, setOpen]);

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Keyboard shortcuts">
      <dl className="space-y-2 text-sm">
        {GO_TO.map((g) => (
          <div key={g.key} className="flex items-center justify-between gap-4">
            <dt>Go to {g.label}</dt>
            <dd className="flex items-center gap-1">
              <Kbd>G</Kbd>
              <span className="text-muted">then</span>
              <Kbd>{g.key.toUpperCase()}</Kbd>
            </dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 border-t border-line pt-2">
          <dt>Refresh account data</dt>
          <dd>
            <Kbd>R</Kbd>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>Show this list</dt>
          <dd>
            <Kbd>?</Kbd>
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-muted">Shortcuts pause while you type in a field.</p>
    </Dialog>
  );
}
