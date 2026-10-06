import { useEffect, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { AnimatePresence, m } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fetchSkin, indexBy } from "@valovertix/assets";
import { useMotionOff } from "@/components/motion";
import { useStatic } from "@/features/data";
import { apiColor } from "@/lib/format";

/** Well-known skins, fetched one by one so the landing page never loads the full catalog. */
const SHOWCASE = [
  "30388628-42f0-606c-82c0-73ad43de997f", // Reaver Vandal
  "18609205-4edb-5966-cff8-0fba0230ba1e", // Elderflame Vandal
  "25a7f0f2-4bce-7e45-b4b0-ca9264f5dfcc", // Glitchpop Phantom
  "36791b03-452d-8dad-0091-898cc28d2196", // Oni Phantom
  "b9ee2457-481c-6776-3f5b-0ca8e8f90c89", // Prime Vandal
  "d8d5d7a1-4d81-8560-54bc-0692ab40f69b", // Kuronami Vandal
];
const ROTATE_MS = 4500;
const EASE = [0.2, 0.8, 0.2, 1] as const;

/**
 * A rotating featured-weapon panel, like the game's store showcase. Real art
 * from valorant-api.com. Pauses on hover and focus, and stays still when
 * reduced motion is on. Hidden entirely if the art can't load.
 */
export function SkinShowcase() {
  const results = useQueries({
    queries: SHOWCASE.map((uuid) => ({
      queryKey: ["showcase", uuid],
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchSkin(uuid, fetch, signal),
      staleTime: Infinity,
      retry: false,
    })),
  });
  const tiers = useStatic("contentTiers");
  const tierById = indexBy(tiers.data ?? []);
  const skins = results.flatMap((r) => (r.data?.displayIcon ? [r.data] : []));

  const off = useMotionOff();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    if (off || paused || skins.length < 2) return;
    const t = setInterval(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % skins.length);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [off, paused, skins.length]);

  if (skins.length === 0) {
    return results.some((r) => r.isPending) ? (
      <div aria-hidden className="skeleton aspect-[16/10] w-full" />
    ) : null;
  }

  const skin = skins[index % skins.length]!;
  const tier = skin.contentTierUuid ? tierById.get(skin.contentTierUuid.toLowerCase()) : undefined;
  const go = (step: number) => {
    setDirection(step);
    setIndex((i) => (i + step + skins.length) % skins.length);
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured skins"
      className="hud-corners relative border border-line bg-bg/40 p-5 sm:p-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Giant faded index behind the weapon, like the game's showcase numbering. */}
      <span
        aria-hidden
        className="numeral-outline pointer-events-none absolute -top-2 right-3 text-[7rem] sm:text-[9rem]"
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      <div className="relative aspect-[16/9] overflow-x-clip">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <m.img
            key={skin.uuid}
            src={skin.displayIcon!}
            alt={skin.displayName}
            custom={direction}
            initial={{ opacity: 0, x: direction * 80, rotate: direction * -4 }}
            animate={{ opacity: 1, x: 0, rotate: -8 }}
            exit={{ opacity: 0, x: direction * -80, rotate: -12 }}
            transition={{ duration: 0.55, ease: EASE }}
            className="absolute inset-0 m-auto max-h-full w-[92%] object-contain drop-shadow-[0_24px_30px_rgb(0_0_0/0.6)]"
          />
        </AnimatePresence>
      </div>

      <div className="relative mt-4 flex items-end justify-between gap-4">
        <div className="min-w-0" aria-live="polite">
          <p className="flex items-center gap-2 text-sm text-muted">
            {tier && (
              <span
                aria-hidden
                className="size-2.5"
                style={{ backgroundColor: apiColor(tier.highlightColor) }}
              />
            )}
            {tier ? tier.displayName.replace(/ Edition$/, "") : "Skin"}
          </p>
          <p className="display-xl truncate text-3xl sm:text-4xl">{skin.displayName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="mr-2 font-display text-sm tabular-nums text-muted">
            {String(index + 1).padStart(2, "0")} / {String(skins.length).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous skin"
            className="inline-flex min-h-11 min-w-11 items-center justify-center border border-line-strong text-muted transition-colors hover:border-text hover:text-text"
          >
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next skin"
            className="inline-flex min-h-11 min-w-11 items-center justify-center border border-line-strong text-muted transition-colors hover:border-text hover:text-text"
          >
            <ChevronRight aria-hidden className="size-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
