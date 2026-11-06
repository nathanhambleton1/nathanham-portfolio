import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { SITES } from "@/lib/sites";
import { cn } from "@/lib/utils";
import { useUnlock } from "./UnlockProvider";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-1.5 text-sm transition-colors ${
    isActive ? "text-foreground bg-foreground/10" : "text-muted-foreground hover:text-foreground"
  }`;

// Fixed header. At the top of the page it's a plain, transparent full-width bar;
// once you scroll it shrinks into a floating, frosted-glass "island".
const SiteHeader = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { guard } = useUnlock();

  // Close the mobile menu whenever the route changes.
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
          "mx-auto border transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
          island
            ? "max-w-4xl rounded-2xl border-foreground/10 bg-background/55 shadow-[0_10px_40px_-12px_rgb(0_0_0/0.55),inset_0_1px_0_0_hsl(var(--foreground)/0.06)] backdrop-blur-xl backdrop-saturate-150"
            : "max-w-6xl rounded-none border-transparent bg-transparent",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-4 transition-all duration-500",
            island ? "h-14 px-3 sm:px-4" : "h-16 px-4 sm:px-6",
          )}
        >
          <Link to="/" className="flex items-center gap-3 font-semibold">
            <img
              src="/logo.png"
              alt=""
              className={cn("rounded-lg transition-all duration-500", island ? "h-7 w-7" : "h-8 w-8")}
            />
            <span>Nathan Hambleton</span>
          </Link>

          <nav aria-label="Sites" className="ml-auto hidden items-center gap-1 md:flex">
            {SITES.map((site) => (
              <NavLink key={site.path} to={site.path} className={linkClass} onClick={guard(site.path)}>
                {site.name}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1 md:ml-2">
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
          <nav aria-label="Sites" className="flex flex-col gap-1 border-t border-foreground/10 p-2 md:hidden">
            <NavLink to="/" end className={linkClass}>
              Home
            </NavLink>
            {SITES.map((site) => (
              <NavLink key={site.path} to={site.path} className={linkClass} onClick={guard(site.path)}>
                {site.name}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
};

export default SiteHeader;
