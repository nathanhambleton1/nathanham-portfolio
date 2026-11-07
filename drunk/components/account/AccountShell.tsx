import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ChevronDown, ChevronLeft, LogIn, LogOut, Menu, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ColorBand } from "../BoardArt";
import PlayerAvatar from "../PlayerAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { signOutAccount, useDrunkAccount } from "../../lib/drunkAccount";
import { formatE164 } from "../../lib/phone";

// Header for Drunkopoly's lobby and account pages. Same bones as the main
// site's SiteHeader (a transparent bar that floats into an island on scroll)
// with the Drunkopoly logo and a property-colour band. The in-game board screen
// keeps its own compact header.

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-1.5 text-sm transition-colors ${
    isActive ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
  }`;

const NAV = [
  { to: "/drunk/drunkopoly", label: "Play", end: true },
  { to: "/drunk/drunkopoly/rules", label: "Rules" },
  { to: "/drunk", label: "All games", end: true },
];

export const LOGO_SRC = "/drunkopoly/logo.webp";

/** The Drunkopoly logo (mascot badge). Wide image, ~3:1. */
export const DrunkopolyLogo = ({ className, alt = "Drunkopoly" }: { className?: string; alt?: string }) => (
  <img src={LOGO_SRC} alt={alt} width={1200} height={400} decoding="async" draggable={false} className={cn("h-auto w-auto select-none", className)} />
);

// The header logo steps aside while a page shows the big hero logo (so the two
// never appear together), then slides in once the hero scrolls out of view.
const HeroLogoContext = createContext<(visible: boolean) => void>(() => {});

/** Big page-title logo. While it's on screen the header hides its own logo. */
export const HeroLogo = ({ className }: { className?: string }) => {
  const setHeroVisible = useContext(HeroLogoContext);
  const ref = useRef<HTMLImageElement>(null);

  // Decide before first paint so the header logo doesn't flash in and out.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setHeroVisible(r.bottom > 64 && r.top < window.innerHeight);
  }, [setHeroVisible]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Top margin = header height: "visible" means not tucked under the header.
    const io = new IntersectionObserver(([e]) => setHeroVisible(e.isIntersecting), { rootMargin: "-64px 0px 0px 0px" });
    io.observe(el);
    return () => {
      io.disconnect();
      setHeroVisible(false);
    };
  }, [setHeroVisible]);

  return (
    <img
      ref={ref}
      src={LOGO_SRC}
      alt="Drunkopoly"
      width={1200}
      height={400}
      decoding="async"
      draggable={false}
      className={cn("h-auto select-none", className)}
    />
  );
};

type ShellProps = {
  children: ReactNode;
  /** Open the profile page (lobby) for the signed-in account. */
  onOpenProfile?: () => void;
  /** Open the sign-in flow for a guest. */
  onSignIn?: () => void;
  /** Called after the account signs out. */
  onSignedOut?: () => void;
  /** Hide the account button (e.g. on the sign-in page itself). */
  hideAccount?: boolean;
  /** A back button in the header's top-left corner (e.g. back to all games). */
  back?: { label: string; onClick: () => void };
};

const AccountButton = ({ onOpenProfile, onSignIn, onSignedOut }: Omit<ShellProps, "children" | "hideAccount">) => {
  const { profile, ready } = useDrunkAccount();
  if (!ready) return <div className="h-10 w-10" />;

  if (!profile) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full border border-foreground/10 bg-foreground/[0.03] px-4 text-sm text-foreground transition-colors hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <LogIn className="h-4 w-4 shrink-0" />
        Sign in
      </button>
    );
  }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.username;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="inline-flex h-10 items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.03] pl-1 pr-3 text-sm text-foreground transition-colors hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <PlayerAvatar player={{ name: fullName, avatar_url: profile.avatar_url }} size="md" />
          <span className="hidden max-w-[8rem] truncate font-medium sm:inline">{profile.first_name || profile.username}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-2">
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-foreground/[0.05]"
        >
          <PlayerAvatar player={{ name: fullName, avatar_url: profile.avatar_url }} size="lg" />
          <div className="min-w-0">
            <div className="truncate font-display font-semibold tracking-tight">{fullName}</div>
            <div className="truncate font-mono text-xs text-muted-foreground">@{profile.username}</div>
            {profile.phone && <div className="truncate font-mono text-xs text-muted-foreground">{formatE164(profile.phone)}</div>}
          </div>
        </button>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="h-10 gap-3" onSelect={() => onOpenProfile?.()}>
          <UserRound className="h-4 w-4" />
          Profile & stats
        </DropdownMenuItem>
        <DropdownMenuItem
          className="h-10 gap-3 text-destructive focus:bg-destructive/10 focus:text-destructive"
          onSelect={async () => {
            await signOutAccount();
            onSignedOut?.();
          }}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const ShellHeader = ({ hideAccount, heroVisible, back, ...accountProps }: Omit<ShellProps, "children"> & { heroVisible: boolean }) => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const island = scrolled || open;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[padding] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
        island ? "px-3 pt-3 sm:px-4" : "px-0 pt-0",
      )}
    >
      <div
        className={cn(
          "mx-auto overflow-hidden border transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
          island
            ? "max-w-4xl rounded-2xl border-foreground/10 bg-background/55 shadow-[0_10px_40px_-12px_rgb(0_0_0/0.55),inset_0_1px_0_0_hsl(var(--foreground)/0.06)] backdrop-blur-xl backdrop-saturate-150"
            : "max-w-6xl rounded-none border-transparent bg-transparent",
        )}
      >
        <div className={cn("flex items-center gap-3 transition-all duration-500", island ? "h-14 px-3 sm:px-4" : "h-16 px-4 sm:px-6")}>
          {/* The back button and the logo swap places: back while the page's
              big logo is on screen, the header logo once it scrolls away. */}
          {back && (
            <div
              aria-hidden={!heroVisible || undefined}
              className={cn(
                "shrink-0 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                heroVisible ? "max-w-[160px] translate-y-0 opacity-100" : "pointer-events-none -mr-3 max-w-0 -translate-y-3 opacity-0",
              )}
            >
              <button
                type="button"
                onClick={back.onClick}
                tabIndex={heroVisible ? undefined : -1}
                aria-label={`Back to ${back.label}`}
                className="inline-flex h-10 w-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-foreground/10 bg-foreground/[0.03] text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:w-auto sm:pl-3 sm:pr-4"
              >
                <ChevronLeft className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{back.label}</span>
              </button>
            </div>
          )}
          <Link
            to="/drunk/drunkopoly"
            aria-label="Drunkopoly home"
            aria-hidden={heroVisible || undefined}
            tabIndex={heroVisible ? -1 : undefined}
            className={cn(
              "flex shrink-0 items-center overflow-hidden rounded-md transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
              // Collapse to no width while hidden so it doesn't squeeze the rest of the header.
              heroVisible ? "pointer-events-none max-w-0 -translate-y-3 scale-90 opacity-0" : "max-w-[220px] translate-y-0 scale-100 opacity-100",
            )}
          >
            <DrunkopolyLogo className={cn("transition-all duration-500", island ? "h-9" : "h-11")} />
          </Link>

          <nav aria-label="Drunkopoly" className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={navClass}>
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5 md:ml-2">
            {!hideAccount && <AccountButton {...accountProps} />}
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground md:hidden"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <nav aria-label="Drunkopoly" className="flex flex-col gap-1 border-t border-foreground/10 p-2 md:hidden">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={navClass}>
                {n.label}
              </NavLink>
            ))}
            <NavLink to="/" end className={navClass}>
              nathanham.tech
            </NavLink>
          </nav>
        )}
        <ColorBand className={cn("h-0.5 gap-0 transition-opacity duration-500", island ? "opacity-70" : "opacity-0")} />
      </div>
    </header>
  );
};

/** Page frame for Drunkopoly's lobby and account screens. */
const AccountShell = ({ children, ...props }: ShellProps) => {
  const [heroVisible, setHeroVisible] = useState(false);
  return (
    <HeroLogoContext.Provider value={setHeroVisible}>
      <div className="flex min-h-screen flex-col bg-gradient-bg text-foreground">
        <ShellHeader {...props} heroVisible={heroVisible} />
        <main className="flex flex-1 flex-col items-center justify-center px-4 pb-16 pt-24">{children}</main>
      </div>
    </HeroLogoContext.Provider>
  );
};

export default AccountShell;
