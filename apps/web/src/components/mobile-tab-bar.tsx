import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { m } from "framer-motion";
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  Home,
  LayoutGrid,
  Menu,
  RefreshCw,
  Settings,
  Share2,
  Shield,
  ShoppingBag,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { AccountSwitcher, ExpiryIndicator, accountLabel } from "@/features/auth/account-bar";
import { useActiveSession, useSessionStore } from "@/features/auth/session-store";
import { useDataFreshness } from "@/features/data-freshness";
import { cn } from "@/lib/cn";
import { Sheet } from "./ui/sheet";

/** The four places players go most; everything else lives under More. */
const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/store", label: "Store", icon: ShoppingBag },
  { to: "/stats", label: "Stats", icon: BarChart3 },
  { to: "/collection", label: "Collection", icon: LayoutGrid },
];

const MORE: { to: string; label: string; icon: LucideIcon; hint: string }[] = [
  { to: "/spending", label: "Spending", icon: Wallet, hint: "What your skins cost" },
  { to: "/share", label: "Share card", icon: Share2, hint: "Image cards and links" },
  { to: "/settings", label: "Settings", icon: Settings, hint: "Accounts, pricing, data" },
  { to: "/guide", label: "How to sign in", icon: BookOpen, hint: "Step by step" },
  { to: "/privacy", label: "Privacy", icon: Shield, hint: "What stays on this device" },
];

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const session = useActiveSession();
  const sessions = useSessionStore((s) => s.sessions);
  const { refresh, fetching } = useDataFreshness();
  return (
    <Sheet open={open} onClose={onClose} title="More">
      <nav aria-label="More pages" className="px-2">
        <ul>
          {MORE.map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                onClick={onClose}
                className="tap flex min-h-14 items-center gap-3 px-2 transition-colors active:bg-raised data-[status=active]:text-accent"
              >
                <l.icon aria-hidden className="size-5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-bold uppercase leading-tight">
                    {l.label}
                  </span>
                  <span className="block text-xs text-muted">{l.hint}</span>
                </span>
                <ChevronRight aria-hidden className="size-4 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {session && (
        <div className="mt-2 space-y-3 border-t border-line px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{accountLabel(session)}</p>
              <ExpiryIndicator session={session} className="text-sm" />
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={fetching}
              className="tap inline-flex min-h-11 items-center gap-2 border border-line-strong px-3 text-sm font-semibold disabled:opacity-60"
            >
              <RefreshCw aria-hidden className={cn("size-4", fetching && "animate-spin")} />
              {fetching ? "Updating…" : "Refresh"}
            </button>
          </div>
          {sessions.length > 1 && <AccountSwitcher />}
        </div>
      )}
    </Sheet>
  );
}

/**
 * Phones and tablets: an app-style tab bar pinned to the bottom, within thumb
 * reach, clear of the home indicator. Desktop keeps the top navigation.
 */
export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [more, setMore] = useState(false);
  const bar = useRef<HTMLElement>(null);
  const inMore = MORE.some((l) => pathname.startsWith(l.to));

  // Lets the rest of the layout (page padding, toasts, action bars) clear the bar.
  useEffect(() => {
    document.documentElement.classList.add("has-tabbar");
    return () => document.documentElement.classList.remove("has-tabbar");
  }, []);
  useEffect(() => setMore(false), [pathname]);

  return (
    <>
      <nav
        ref={bar}
        aria-label="Tab bar"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
          {TABS.map((t) => (
            <li key={t.to}>
              <Link
                to={t.to}
                className="tap relative flex h-full flex-col items-center justify-center gap-1 text-muted transition-colors data-[status=active]:text-text"
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <m.span
                        layoutId="tab-active"
                        aria-hidden
                        className="absolute inset-x-4 top-0 h-[3px] bg-accent"
                        transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      />
                    )}
                    <t.icon aria-hidden className={cn("size-5", isActive && "text-accent")} />
                    <span className="font-display text-[0.7rem] font-semibold uppercase tracking-[0.08em]">
                      {t.label}
                    </span>
                  </>
                )}
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={more}
              onClick={() => setMore(true)}
              className={cn(
                "tap relative flex h-full w-full flex-col items-center justify-center gap-1 transition-colors",
                inMore || more ? "text-text" : "text-muted",
              )}
            >
              {inMore && (
                <m.span
                  layoutId="tab-active"
                  aria-hidden
                  className="absolute inset-x-4 top-0 h-[3px] bg-accent"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <Menu aria-hidden className={cn("size-5", inMore && "text-accent")} />
              <span className="font-display text-[0.7rem] font-semibold uppercase tracking-[0.08em]">
                More
              </span>
            </button>
          </li>
        </ul>
      </nav>
      <MoreSheet open={more} onClose={() => setMore(false)} />
    </>
  );
}
