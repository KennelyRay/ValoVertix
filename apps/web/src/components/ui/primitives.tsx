import {
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { m } from "framer-motion";
import { Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

export function Panel({
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { as?: "section" | "div" }) {
  return <section className={cn("panel p-4 sm:p-5", className)} {...props} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton", className)} />;
}

/** Marks a figure as an estimate. Text, not color, carries the meaning. */
export function EstimateTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block border border-warn/50 px-1.5 py-px font-display text-xs font-semibold tracking-wide text-warn",
        className,
      )}
    >
      ESTIMATE
    </span>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer font-medium">
          {label}
        </label>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative inline-flex min-h-11 min-w-14 shrink-0 items-center"
      >
        <span
          aria-hidden
          className={cn(
            "h-6 w-11 border transition-colors",
            checked ? "border-accent bg-accent/25" : "border-line-strong bg-raised",
          )}
        />
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 h-4 w-4 -translate-y-1/2 transition-transform",
            checked ? "translate-x-6 bg-accent" : "translate-x-1 bg-muted",
          )}
        />
      </button>
    </div>
  );
}

/** Accessible tabs: arrow keys move between tabs, Tab moves into the panel. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { id: T; label: ReactNode }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const groupId = useId();
  const onKey = (e: KeyboardEvent, index: number) => {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? tabs.length - 1
          : (index + delta + tabs.length) % tabs.length;
    const tab = tabs[next];
    if (tab) {
      onChange(tab.id);
      refs.current[next]?.focus();
    }
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-1 overflow-x-auto border-b border-line"
    >
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={t.id === value}
          aria-controls={`panel-${t.id}`}
          tabIndex={t.id === value ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKey(e, i)}
          className={cn(
            "relative -mb-px min-h-11 shrink-0 px-3 font-display text-base font-semibold transition-colors",
            t.id === value ? "text-text" : "text-muted hover:text-text",
          )}
        >
          {t.label}
          {t.id === value && (
            // Slides between tabs.
            <m.span
              layoutId={`tab-underline-${groupId}`}
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-0.5 bg-accent"
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

/** A small disclosure panel anchored to an info button. Closes on Escape or outside click. */
export function InfoPopover({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={root} className={cn("relative inline-block", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 text-sm text-muted hover:text-text"
      >
        <Info aria-hidden className="size-4" />
        <span className="underline decoration-dotted underline-offset-4">{label}</span>
      </button>
      {open && (
        <div
          id={id}
          role="region"
          aria-label={label}
          className="pop-in absolute left-0 z-30 mt-1 w-[min(22rem,calc(100vw-2rem))] border border-line-strong bg-raised p-4 text-sm leading-relaxed shadow-2xl shadow-black/60"
        >
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Native <dialog>: focus trap, Escape and inert background come from the browser.
 * `side` renders it as a drawer on wide screens.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  side = false,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  side?: boolean;
  /** A large centered dialog, for tables like the match scoreboard. */
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 max-h-dvh max-w-none border-line-strong bg-surface p-0 text-text",
        side
          ? "drawer ml-auto h-dvh w-full border-l sm:w-[34rem]"
          : wide
            ? "modal mx-auto mt-[4vh] w-[min(66rem,calc(100vw-1rem))] border"
            : "modal mx-auto mt-[10vh] w-[min(32rem,calc(100vw-2rem))] border",
      )}
    >
      {open && (
        <div className="flex max-h-dvh flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2 sm:px-5">
            <h2 id={titleId} className="min-w-0 truncate text-xl">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted hover:text-text"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto p-4 sm:p-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function ErrorNote({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div role="alert" className="border border-loss/50 bg-loss/5 p-4">
      <p className="font-semibold text-loss">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function EmptyNote({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border border-dashed border-line-strong p-6 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}
