import { useEffect, useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useExpiryWatcher } from "@/features/auth/actions";
import { useSettings } from "@/features/settings-store";
import { cn } from "@/lib/cn";
import { Backdrop } from "./backdrop";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { BrandMark, SiteNav } from "./site-nav";
import { PageTransition } from "./motion";
import { StatusBanners } from "./status-banners";
import { Toaster } from "./toast";

function Footer({ onShortcuts }: { onShortcuts: () => void }) {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl space-y-3">
          <BrandMark />
          <p>
            Not endorsed by or affiliated with Riot Games. Uses unofficial endpoints that may
            change.
          </p>
        </div>
        <nav aria-label="Footer" className="-mx-2 flex flex-wrap">
          <Link to="/guide" className="inline-flex min-h-11 items-center px-2 hover:text-text">
            Sign-in guide
          </Link>
          <Link to="/privacy" className="inline-flex min-h-11 items-center px-2 hover:text-text">
            Privacy
          </Link>
          <Link to="/terms" className="inline-flex min-h-11 items-center px-2 hover:text-text">
            Terms
          </Link>
          <button
            type="button"
            onClick={onShortcuts}
            className="inline-flex min-h-11 items-center px-2 hover:text-text max-sm:hidden"
          >
            Keyboard shortcuts
          </button>
        </nav>
      </div>
    </footer>
  );
}

export function AppShell() {
  useExpiryWatcher();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const motion = useSettings((s) => s.motion);
  const [shortcuts, setShortcuts] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.motion = motion;
  }, [motion]);

  return (
    <div className="flex min-h-dvh flex-col">
      <Backdrop />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-raised focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <SiteNav />
      <div className="pt-4">
        <StatusBanners />
      </div>
      <main
        id="main"
        tabIndex={-1}
        className={cn("mx-auto min-h-dvh w-full max-w-7xl flex-1 px-4 pb-8 outline-none")}
      >
        <PageTransition routeKey={pathname}>
          <Outlet />
        </PageTransition>
      </main>
      <Footer onShortcuts={() => setShortcuts(true)} />
      <KeyboardShortcuts open={shortcuts} setOpen={setShortcuts} />
      <Toaster />
    </div>
  );
}
