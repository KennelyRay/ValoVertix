import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { useIsPhone } from "@/lib/use-media";
import { Sheet } from "./sheet";

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  /** Optional secondary text, e.g. a count. */
  hint?: ReactNode;
}

/**
 * A select-only combobox (WAI-ARIA APG pattern) styled after the game's
 * menus: a squared field, a red bar marking the chosen option and a short
 * open animation. Keyboard: Enter/Space/Arrow keys open; arrows, Home and
 * End move; typing jumps to an option; Enter selects; Escape or Tab closes.
 */
export function Dropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  hideLabel = false,
  className,
  size = "md",
}: {
  label: string;
  value: T;
  options: readonly DropdownOption<T>[];
  onChange: (value: T) => void;
  hideLabel?: boolean;
  className?: string;
  size?: "sm" | "md";
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const listId = `${id}-list`;
  const trigger = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Where the open list sits on screen. It renders on <body> (or the open dialog),
  // so no panel, overflow or stacking context around the field can cover or clip it.
  const [place, setPlace] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    maxHeight: number;
    upward: boolean;
  } | null>(null);
  const upward = place?.upward ?? false;
  const typed = useRef({ text: "", at: 0 });

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const selected = options[selectedIndex];

  const openList = (index = selectedIndex) => {
    setActive(index);
    setOpen(true);
  };
  const choose = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  };

  // Follow the field: open upward when there isn't room below, and stay attached
  // while the page or a dialog scrolls or the window resizes.
  useLayoutEffect(() => {
    if (!open || phone || !trigger.current) return;
    const measure = () => {
      const r = trigger.current!.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - 8;
      const above = r.top - 8;
      const up = below < 220 && above > below;
      setPlace({
        left: r.left,
        width: r.width,
        ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
        maxHeight: Math.max(120, Math.min(288, (up ? above : below) - 4)),
        upward: up,
      });
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, phone]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      // The phone sheet renders elsewhere in the DOM and handles its own closing.
      if (phone || root.current?.contains(target) || list.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, phone]);

  // Keep the active option in view while moving with the keyboard.
  useEffect(() => {
    if (open)
      document.getElementById(`${id}-opt-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, active, id]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1;
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        openList(e.key === "ArrowUp" ? Math.max(0, selectedIndex - 1) : selectedIndex);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(last, i + 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        return;
      case "Home":
        e.preventDefault();
        setActive(0);
        return;
      case "End":
        e.preventDefault();
        setActive(last);
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        return;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        return;
      case "Tab":
        setOpen(false);
        return;
    }
    // Typeahead: jump to the next option starting with what was typed.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      typed.current.text = now - typed.current.at > 600 ? e.key : typed.current.text + e.key;
      typed.current.at = now;
      const q = typed.current.text.toLowerCase();
      const order = [...options.keys()].map((k) => (active + 1 + k) % options.length);
      const hit = order.find((k) => options[k]!.label.toLowerCase().startsWith(q));
      if (hit !== undefined) setActive(hit);
    }
  };

  return (
    <div ref={root} className={cn("relative min-w-0", className)}>
      <span
        id={labelId}
        className={cn(
          "mb-1 block font-display text-xs font-semibold uppercase tracking-[0.08em] text-muted",
          hideLabel && "sr-only",
        )}
      >
        {label}
      </span>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={cn(
          "group relative flex w-full items-center justify-between gap-2 border bg-bg/70 pl-3 pr-2 text-left transition-colors",
          size === "sm" ? "min-h-11 text-sm" : "min-h-11",
          open ? "border-text" : "border-line-strong hover:border-muted",
        )}
      >
        {/* Red notch on the left edge while open. */}
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0 left-0 w-[3px] bg-accent transition-transform duration-200",
            open ? "scale-y-100" : "scale-y-0",
          )}
        />
        <span className="min-w-0 truncate">{selected?.label ?? "Choose"}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-muted transition-transform duration-200",
            open && "rotate-180 text-text",
          )}
        />
      </button>

      {phone ? (
        <Sheet
          open={open}
          onClose={() => setOpen(false)}
          anchor={root.current}
          title={label}
          role="presentation"
        >
          <ul ref={list} id={listId} role="listbox" aria-labelledby={labelId} className="pb-2">
            {options.map((o, i) => {
              const isSelected = o.value === value;
              return (
                <li
                  key={o.value}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setActive(i)}
                  // Mouse: keep focus on the trigger. Touch: wait for the tap,
                  // so scrolling the list never picks an option by accident.
                  onPointerDown={(e) => e.pointerType === "mouse" && e.preventDefault()}
                  onClick={() => choose(i)}
                  className={cn(
                    "relative flex cursor-pointer items-center gap-2 px-3",
                    phone ? "min-h-12 text-base" : "min-h-11 text-sm",
                    i === active ? "bg-line text-text" : "text-muted",
                    isSelected && "font-semibold text-text",
                  )}
                >
                  {isSelected && (
                    <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] bg-accent" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.hint !== undefined && (
                    <span className="shrink-0 text-xs text-muted">{o.hint}</span>
                  )}
                  {isSelected && <Check aria-hidden className="size-4 shrink-0 text-accent" />}
                </li>
              );
            })}
          </ul>
        </Sheet>
      ) : (
        createPortal(
          <AnimatePresence>
            {open && (
              <m.ul
                ref={list}
                id={listId}
                role="listbox"
                aria-labelledby={labelId}
                initial={{ opacity: 0, y: upward ? 6 : -6, scaleY: 0.96 }}
                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                exit={{ opacity: 0, y: upward ? 4 : -4, transition: { duration: 0.1 } }}
                transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
                style={{
                  transformOrigin: upward ? "bottom" : "top",
                  position: "fixed",
                  left: place?.left ?? 0,
                  width: place?.width,
                  top: place?.top,
                  bottom: place?.bottom,
                  maxHeight: place?.maxHeight ?? 288,
                }}
                className="z-[80] overflow-y-auto overscroll-contain border border-line-strong bg-raised py-1 shadow-2xl shadow-black/60 [scrollbar-color:var(--color-line-strong)_transparent] [scrollbar-width:thin]"
              >
                {options.map((o, i) => {
                  const isSelected = o.value === value;
                  return (
                    <li
                      key={o.value}
                      id={`${id}-opt-${i}`}
                      role="option"
                      aria-selected={isSelected}
                      onPointerEnter={(e) => e.pointerType === "mouse" && setActive(i)}
                      // Mouse: keep focus on the trigger. Touch: wait for the tap,
                      // so scrolling the list never picks an option by accident.
                      onPointerDown={(e) => e.pointerType === "mouse" && e.preventDefault()}
                      onClick={() => choose(i)}
                      className={cn(
                        "relative flex cursor-pointer items-center gap-2 px-3",
                        phone ? "min-h-12 text-base" : "min-h-11 text-sm",
                        i === active ? "bg-line text-text" : "text-muted",
                        isSelected && "font-semibold text-text",
                      )}
                    >
                      {isSelected && (
                        <span
                          aria-hidden
                          className="absolute inset-y-1.5 left-0 w-[3px] bg-accent"
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      {o.hint !== undefined && (
                        <span className="shrink-0 text-xs text-muted">{o.hint}</span>
                      )}
                      {isSelected && <Check aria-hidden className="size-4 shrink-0 text-accent" />}
                    </li>
                  );
                })}
              </m.ul>
            )}
          </AnimatePresence>,
          root.current?.closest("dialog[open]") ?? document.body,
        )
      )}
    </div>
  );
}
