import { useEffect, useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { AccountSwitcher, ExpiryIndicator } from "@/features/auth/account-bar";
import { useActiveSession } from "@/features/auth/session-store";
import { useExpiryWatcher } from "@/features/auth/actions";
import { useSettings } from "@/features/settings-store";
import { cn } from "@/lib/cn";
import { StatusBanners } from "./status-banners";
import { Toaster } from "./toast";

const APP_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/spending", label: "Spending" },
  { to: "/stats", label: "Stats" },
  { to: "/collection", label: "Collection" },
  { to: "/share", label: "Share card" },
  { to: "/settings", label: "Accounts" },
] as const;

const PUBLIC_LINKS = [
  { to: "/guide", label: "How to sign in" },
  { to: "/privacy", label: "Privacy" },
] as const;

const linkClass =
  "relative inline-flex min-h-11 items-center px-3 font-display text-base font-semibold text-muted hover:text-text data-[status=active]:text-text";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const session = useActiveSession();
  const links = session ? APP_LINKS : PUBLIC_LINKS;
  return (
    <>
      {links.map((l) => (
        <Link key={l.to} to={l.to} className={linkClass} onClick={onNavigate}>
          {({ isActive }) => (
            <>
              {l.label}
              {isActive && (
                <span aria-hidden className="absolute inset-x-3 bottom-1.5 h-0.5 bg-accent" />
              )}
            </>
          )}
        </Link>
      ))}
    </>
  );
}

function Header() {
  const session = useActiveSession();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-1">
        <Link
          to="/"
          className="mr-2 inline-flex min-h-11 items-center font-display text-2xl font-bold tracking-tight"
        >
          Valo<span className="text-accent">Vertix</span>
        </Link>
        <nav aria-label="Main" className="hidden flex-1 items-center lg:flex">
          <NavLinks />
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-3">
          {session && (
            <>
              <ExpiryIndicator session={session} className="hidden sm:inline-flex" />
              <AccountSwitcher />
            </>
          )}
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted hover:text-text lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X aria-hidden className="size-6" /> : <Menu aria-hidden className="size-6" />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="border-t border-line px-2 pb-3 lg:hidden">
          <div className="flex flex-col">
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
          {session && <ExpiryIndicator session={session} className="px-3 pt-2 sm:hidden" />}
        </nav>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl">
          Not endorsed by or affiliated with Riot Games. Uses unofficial endpoints that may change.
        </p>
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
        </nav>
      </div>
    </footer>
  );
}

export function AppShell() {
  useExpiryWatcher();
  const motion = useSettings((s) => s.motion);
  useEffect(() => {
    document.documentElement.dataset.motion = motion;
  }, [motion]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-raised focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <Header />
      <div className="pt-4">
        <StatusBanners />
      </div>
      <main
        id="main"
        tabIndex={-1}
        className={cn("mx-auto min-h-dvh w-full max-w-7xl flex-1 px-4 pb-8 outline-none")}
      >
        <Outlet />
      </main>
      <Footer />
      <Toaster />
    </div>
  );
}
