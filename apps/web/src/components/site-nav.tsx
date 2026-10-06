import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, m } from "framer-motion";
import { isUuid } from "@valovertix/riot";
import { AccountSwitcher, ExpiryIndicator, accountLabel } from "@/features/auth/account-bar";
import { useActiveSession, useSessionStore, type Session } from "@/features/auth/session-store";
import { useLoadout } from "@/features/data";
import { cn } from "@/lib/cn";

const APP_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/store", label: "Store" },
  { to: "/spending", label: "Spending" },
  { to: "/stats", label: "Stats" },
  { to: "/collection", label: "Collection" },
  { to: "/share", label: "Share card" },
] as const;

const PUBLIC_LINKS = [
  { to: "/guide", label: "How to sign in" },
  { to: "/privacy", label: "Privacy" },
] as const;

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** The V mark from the ValoVertix logo, plus the wordmark in the logo's colors. */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <img src="/brand/mark.png" alt="" width={46} height={35} className="h-8 w-auto sm:h-9" />
      {!compact && (
        <span className="font-display text-2xl font-bold italic leading-none tracking-tight">
          Valo<span className="text-accent">Vertix</span>
        </span>
      )}
    </span>
  );
}

/** Equipped player card thumbnail (valorant-api.com image by card ID). */
function CardAvatar({ size = 36 }: { size?: number }) {
  const loadout = useLoadout();
  const id = loadout.data?.PlayerCardID;
  const src =
    id && isUuid(id) ? `https://media.valorant-api.com/playercards/${id}/smallart.png` : null;
  return src ? (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 border border-line-strong"
    />
  ) : (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="shrink-0 border border-line-strong bg-raised"
    />
  );
}

function AccountChip({ session }: { session: Session }) {
  return (
    <Link
      to="/settings"
      className="group inline-flex min-h-11 min-w-0 items-center gap-2.5 border border-transparent px-1.5 py-1 transition-colors hover:border-line-strong hover:bg-bg/60"
    >
      <CardAvatar />
      <span className="hidden min-w-0 leading-tight sm:block">
        <span className="block max-w-40 truncate text-sm font-semibold">
          {accountLabel(session)}
        </span>
        <ExpiryIndicator session={session} className="text-xs" />
      </span>
      <span className="sr-only">Accounts and settings</span>
    </Link>
  );
}

function DesktopLinks() {
  const session = useActiveSession();
  const links = session ? APP_LINKS : PUBLIC_LINKS;
  return (
    <ul className="flex items-center">
      {links.map((l) => (
        <li key={l.to}>
          <Link
            to={l.to}
            className="nav-link relative inline-flex h-16 items-center px-3 font-display text-[0.95rem] font-semibold uppercase tracking-[0.06em] text-muted transition-colors hover:text-text data-[status=active]:text-text"
          >
            {({ isActive }) => (
              <>
                {l.label}
                {isActive && (
                  // Slides to the new link on navigation.
                  <m.span
                    layoutId="nav-active-desktop"
                    aria-hidden
                    className="absolute inset-x-3 bottom-0 h-[3px] bg-accent"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
              </>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  const session = useActiveSession();
  const sessions = useSessionStore((s) => s.sessions);
  const links = session
    ? [...APP_LINKS, { to: "/settings", label: "Accounts" } as const]
    : PUBLIC_LINKS;
  const first = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // Keep the page behind the menu from scrolling.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <m.nav
      id="mobile-nav"
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 top-16 z-40 flex flex-col overflow-y-auto border-t border-line bg-bg px-4 pb-8 pt-4 lg:hidden"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: EASE }}
    >
      <m.ul
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.04 } } }}
        className="divide-y divide-line border-y border-line"
      >
        {links.map((l, i) => (
          <m.li
            key={l.to}
            variants={{
              hidden: { opacity: 0, x: -16 },
              show: { opacity: 1, x: 0, transition: { ease: EASE } },
            }}
          >
            <Link
              ref={i === 0 ? first : undefined}
              to={l.to}
              onClick={onClose}
              className="flex min-h-14 items-center justify-between font-display text-2xl font-bold uppercase tracking-[0.02em] text-muted data-[status=active]:text-text"
            >
              {({ isActive }) => (
                <>
                  {l.label}
                  {isActive && <span aria-hidden className="h-6 w-1 bg-accent" />}
                </>
              )}
            </Link>
          </m.li>
        ))}
      </m.ul>

      {session ? (
        <div className="mt-8 space-y-3">
          <div className="flex items-center gap-3">
            <CardAvatar size={44} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{accountLabel(session)}</p>
              <ExpiryIndicator session={session} />
            </div>
          </div>
          {sessions.length > 1 && <AccountSwitcher />}
        </div>
      ) : (
        <Link
          to="/"
          hash="connect"
          onClick={onClose}
          className="btn-valo btn-valo-primary mt-8 self-start"
        >
          Connect your account
        </Link>
      )}
    </m.nav>
  );
}

/**
 * Site header, in the game website's style: logo left, uppercase links with a
 * sliding red bar, account on the right. Transparent over the page art at the
 * top, solid once the page scrolls.
 */
export function SiteNav() {
  const session = useActiveSession();
  const sessions = useSessionStore((s) => s.sessions);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors duration-300",
        scrolled || open ? "border-line bg-bg/95" : "border-transparent bg-bg/40",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link
          to="/"
          aria-label="ValoVertix home"
          className="inline-flex min-h-11 shrink-0 items-center"
        >
          <BrandMark />
        </Link>

        <span aria-hidden className="hidden h-6 w-px bg-line-strong lg:block" />

        <nav aria-label="Main" className="hidden flex-1 lg:block">
          <DesktopLinks />
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          {session ? (
            <>
              {sessions.length > 1 && (
                <span className="hidden xl:block">
                  <AccountSwitcher />
                </span>
              )}
              <AccountChip session={session} />
            </>
          ) : (
            <Link
              to="/"
              hash="connect"
              className="btn-valo btn-valo-primary hidden min-h-10 px-5 text-sm sm:inline-flex"
            >
              Connect
            </Link>
          )}
          <button
            type="button"
            className="relative inline-flex min-h-11 min-w-11 items-center justify-center text-text lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            {/* Three bars that fold into an X. */}
            <span aria-hidden className="relative block h-4 w-6">
              <m.span
                className="absolute left-0 top-0 h-0.5 w-6 bg-current"
                animate={open ? { top: 7, rotate: 45 } : { top: 0, rotate: 0 }}
                transition={{ duration: 0.2, ease: EASE }}
              />
              <m.span
                className="absolute left-0 top-[7px] h-0.5 w-4 bg-accent"
                animate={{ opacity: open ? 0 : 1 }}
                transition={{ duration: 0.15 }}
              />
              <m.span
                className="absolute left-0 top-[14px] h-0.5 w-6 bg-current"
                animate={open ? { top: 7, rotate: -45 } : { top: 14, rotate: 0 }}
                transition={{ duration: 0.2, ease: EASE }}
              />
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence>{open && <MobileMenu onClose={close} />}</AnimatePresence>
    </header>
  );
}
