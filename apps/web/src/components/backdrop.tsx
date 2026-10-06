import { useEffect, useMemo, useState } from "react";
import { indexBy } from "@valovertix/assets";
import { useActiveSession } from "@/features/auth/session-store";
import { useStatic, useStorefront } from "@/features/data";
import { useSettings } from "@/features/settings-store";
import { cn } from "@/lib/cn";

/** Maps in the competitive pool: their splash art stands in for the game lobby. */
const LOBBY_MAPS = [
  "Ascent",
  "Bind",
  "Haven",
  "Split",
  "Lotus",
  "Sunset",
  "Icebox",
  "Breeze",
  "Pearl",
  "Abyss",
  "Fracture",
  "Corrode",
];
const ROTATE_MS = 60_000;

function prefersReducedMotion(setting: string) {
  return setting === "reduce" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const saveData = () =>
  Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

/** Signed in: the featured bundle art (like the in-game store). Otherwise: map splashes (lobby). */
function useBackdropImages(): string[] {
  const session = useActiveSession();
  const storefront = useStorefront(Boolean(session));
  const bundles = useStatic("bundles", Boolean(storefront.data?.bundles.length));
  const maps = useStatic("maps");

  return useMemo(() => {
    const bundleIndex = indexBy(bundles.data ?? []);
    const bundleArt = (storefront.data?.bundles ?? [])
      .map((b) => bundleIndex.get(b.dataAssetId)?.displayIcon)
      .filter((u): u is string => Boolean(u));
    if (session && bundleArt.length) return bundleArt;
    const splashes = (maps.data ?? [])
      .filter((m) => m.splash && LOBBY_MAPS.includes(m.displayName))
      .map((m) => m.splash!);
    // A stable shuffle per page load, so each visit opens on a different map.
    const offset = splashes.length ? Math.floor(Math.random() * splashes.length) : 0;
    return [...splashes.slice(offset), ...splashes.slice(0, offset)].slice(0, 4);
    // Shuffle once per data change, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, storefront.data, bundles.data, maps.data]);
}

/** Loads an image fully before showing it, so a cross-fade never reveals a half-drawn picture. */
function preload(src: string) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = img.onerror = () => resolve();
    img.src = src;
  });
}

/**
 * Full-page animated background: slowly drifting art (bundle or map), a dark
 * scrim that keeps text at WCAG AA, and a HUD grid. Decorative only.
 */
export function Backdrop() {
  const enabled = useSettings((s) => s.backdropArt);
  const motion = useSettings((s) => s.motion);
  const images = useBackdropImages();
  const [ready, setReady] = useState(false);
  const [layers, setLayers] = useState<{ a: string | null; b: string | null; front: "a" | "b" }>({
    a: null,
    b: null,
    front: "a",
  });

  // Start loading art only after the page itself has finished loading.
  useEffect(() => {
    const go = () => setReady(true);
    if (document.readyState === "complete") {
      const t = setTimeout(go, 300);
      return () => clearTimeout(t);
    }
    window.addEventListener("load", go, { once: true });
    return () => window.removeEventListener("load", go);
  }, []);

  const showArt = enabled && ready && !saveData() && images.length > 0;

  useEffect(() => {
    if (!showArt) return;
    let cancelled = false;
    let index = 0;
    const show = async (src: string) => {
      await preload(src);
      if (cancelled) return;
      setLayers((l) =>
        l.front === "a" && !l.a
          ? { ...l, a: src }
          : l.front === "a"
            ? { a: l.a, b: src, front: "b" }
            : { a: src, b: l.b, front: "a" },
      );
    };
    void show(images[0]!);
    if (images.length < 2 || prefersReducedMotion(motion)) return () => void (cancelled = true);
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      index = (index + 1) % images.length;
      void show(images[index]!);
    }, ROTATE_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [showArt, images, motion]);

  return (
    <div aria-hidden className="backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {showArt &&
        // The previous image stays underneath while the new one fades in on top.
        (layers.front === "a" ? (["b", "a"] as const) : (["a", "b"] as const)).map((key) => {
          const src = layers[key];
          return src ? (
            <img
              key={key + src}
              src={src}
              alt=""
              decoding="async"
              className={cn("backdrop-art", layers.front === key && "backdrop-art-in")}
            />
          ) : null;
        })}
      <div className="backdrop-scrim" />
      <div className="backdrop-grid" />
    </div>
  );
}
