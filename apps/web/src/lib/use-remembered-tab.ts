import { useCallback, useState } from "react";

/**
 * A tab choice remembered in this browser (key "vv.tab.<name>"), so pages
 * reopen where you left them. A convenience only: it falls back to the
 * default when storage is blocked or holds something unexpected.
 */
export function useRememberedTab<T extends string>(
  name: string,
  initial: T,
  allowed: readonly T[],
) {
  const key = `vv.tab.${name}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved && (allowed as readonly string[]).includes(saved) ? (saved as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        // Storage blocked: the choice lasts until the page closes.
      }
    },
    [key],
  );
  return [value, set] as const;
}
