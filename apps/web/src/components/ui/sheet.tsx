import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

/**
 * Drag-to-dismiss for a bottom sheet: pull the handle (or header) down past
 * a threshold, or flick it, to close. Returns props for the drag area and the
 * current offset for the sheet.
 */
export function useSwipeDown(onClose: () => void) {
  const [dy, setDy] = useState(0);
  const start = useRef<{ y: number; t: number } | null>(null);
  return {
    dy,
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType === "mouse") return;
        start.current = { y: e.clientY, t: e.timeStamp };
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (!start.current) return;
        setDy(Math.max(0, e.clientY - start.current.y));
      },
      onPointerUp: (e: React.PointerEvent) => {
        if (!start.current) return;
        const moved = e.clientY - start.current.y;
        const speed = moved / Math.max(1, e.timeStamp - start.current.t);
        start.current = null;
        setDy(0);
        if (moved > 90 || speed > 0.6) onClose();
      },
      onPointerCancel: () => {
        start.current = null;
        setDy(0);
      },
    },
  };
}

/** The visible grab bar at the top of a sheet. */
export function SheetHandle() {
  return <span aria-hidden className="mx-auto mb-1 mt-2 block h-1 w-10 bg-line-strong" />;
}

/**
 * A bottom sheet for phones: slides up over a dimmed page, scrolls inside,
 * respects the home-indicator area and closes on backdrop tap, Escape or a
 * downward swipe. It renders into an open <dialog> when there is one, so it
 * stays above the dialog's top layer.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  anchor,
  className,
  labelledBy,
  role = "dialog",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Any element inside the page or dialog the sheet belongs to. */
  anchor?: HTMLElement | null;
  className?: string;
  /** Use an existing label instead of the title. */
  labelledBy?: string;
  role?: "dialog" | "presentation";
}) {
  const titleId = useId();
  const { dy, handlers } = useSwipeDown(onClose);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  const host = anchor?.closest("dialog[open]") ?? document.body;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col justify-end" data-sheet>
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="sheet-backdrop absolute inset-0 bg-[rgb(5_7_10/0.7)]"
      />
      <div
        role={role === "dialog" ? "dialog" : undefined}
        aria-modal={role === "dialog" ? true : undefined}
        aria-labelledby={
          role === "dialog" ? (labelledBy ?? (title ? titleId : undefined)) : undefined
        }
        className={cn(
          "sheet-in relative flex max-h-[85dvh] flex-col border-t border-line-strong bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_rgba(0,0,0,0.5)]",
          className,
        )}
        style={dy ? { transform: `translateY(${dy}px)`, transition: "none" } : undefined}
      >
        <div {...handlers} className="touch-none select-none">
          <SheetHandle />
          {title && (
            <p id={titleId} className="px-4 pb-2 pt-1 font-display text-lg font-bold">
              {title}
            </p>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    host,
  );
}
