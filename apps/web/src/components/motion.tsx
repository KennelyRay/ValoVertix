import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, m, useReducedMotion, type Variants } from "framer-motion";
import { useSettings } from "@/features/settings-store";

/**
 * Motion vocabulary (antislop R-19, MOTION dial 2): short, purposeful and
 * never looping. Pages ease in, card groups stagger in once, headline numbers
 * count to their value, and active markers slide between items. Everything
 * respects reduced motion (system setting or the in-app switch).
 */

export function useMotionOff() {
  const system = useReducedMotion();
  const setting = useSettings((s) => s.motion);
  return Boolean(system) || setting === "reduce";
}

const EASE = [0.2, 0.8, 0.2, 1] as const;

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE } },
};

/** A container whose direct Stagger.Item children fade up one after another, once. */
export function Stagger({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "ul" | "dl";
}) {
  const Component = as === "ul" ? m.ul : as === "dl" ? m.dl : m.div;
  return (
    <Component className={className} variants={staggerParent} initial="hidden" animate="show">
      {children}
    </Component>
  );
}

Stagger.Item = function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  const Component = as === "li" ? m.li : m.div;
  return (
    <Component className={className} variants={staggerChild}>
      {children}
    </Component>
  );
};

/** Each route eases in when it mounts. */
export function PageTransition({ children, routeKey }: { children: ReactNode; routeKey: string }) {
  return (
    <m.div
      key={routeKey}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: EASE }}
    >
      {children}
    </m.div>
  );
}

/**
 * Counts from the previous value to the new one, so a headline figure lands
 * with a little weight and a change (e.g. toggling agents) is visible.
 * Screen readers get the final value only.
 */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const off = useMotionOff();
  const [shown, setShown] = useState(off ? value : 0);
  const from = useRef(off ? value : 0);

  useEffect(() => {
    if (off) {
      setShown(value);
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration: 0.9,
      ease: EASE,
      onUpdate: (v) => setShown(v),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, off]);

  return (
    <>
      <span aria-hidden>{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
