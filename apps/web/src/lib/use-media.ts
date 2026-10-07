import { useSyncExternalStore } from "react";

function subscribe(query: string) {
  return (onChange: () => void) => {
    if (typeof window === "undefined" || !window.matchMedia) return () => {};
    const mq = window.matchMedia(query);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  };
}

/** Live result of a CSS media query (false where matchMedia is unavailable). */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    subscribe(query),
    () =>
      typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false,
    () => false,
  );
}

/** Phone-width screens, where menus and popovers open as bottom sheets. */
export const PHONE_QUERY = "(max-width: 639px)";
export const useIsPhone = () => useMedia(PHONE_QUERY);
