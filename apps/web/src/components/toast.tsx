import { useEffect } from "react";
import { X } from "lucide-react";
import { create } from "zustand";
import { cn } from "@/lib/cn";

type Tone = "info" | "error" | "success";
interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

const useToasts = create<{
  toasts: Toast[];
  push: (m: string, t: Tone) => void;
  dismiss: (id: number) => void;
}>((set) => ({
  toasts: [],
  push: (message, tone) =>
    set((s) => ({
      toasts: [...s.toasts.slice(-2), { id: Date.now() + Math.random(), message, tone }],
    })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  info: (m: string) => useToasts.getState().push(m, "info"),
  error: (m: string) => useToasts.getState().push(m, "error"),
  success: (m: string) => useToasts.getState().push(m, "success"),
};

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useToasts((s) => s.dismiss);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(t.id), t.tone === "error" ? 8000 : 4500);
    return () => clearTimeout(timer);
  }, [t, dismiss]);
  return (
    <div
      className={cn(
        "toast-in flex items-start gap-3 border bg-raised py-1 pl-4 pr-1 text-sm shadow-xl shadow-black/50",
        t.tone === "error"
          ? "border-loss/60"
          : t.tone === "success"
            ? "border-win/50"
            : "border-line-strong",
      )}
    >
      <p className="flex-1 py-2.5">{t.message}</p>
      <button
        type="button"
        onClick={() => dismiss(t.id)}
        aria-label="Dismiss"
        className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted hover:text-text"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto w-full">
          <ToastItem t={t} />
        </div>
      ))}
    </div>
  );
}
