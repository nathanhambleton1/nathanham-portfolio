import { useEffect, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Github, Linkedin, Lock, Video } from "lucide-react";
import { COMPANY, SITES, SOCIAL_LINKS, DEFAULT_TITLE, type Site } from "@/lib/sites";
import { cn } from "@/lib/utils";
import { BRANDS } from "@/lib/brands";
import BrandLogo from "@/components/BrandLogo";
import { useUnlock } from "@/components/UnlockProvider";

// Landing page at "/": a hero, then a bento grid of every site in src/lib/sites.ts.
// Sites without an entry in LAYOUT/ART below still render as a plain tile.

const STATS = [
  { value: "150M+", label: "views" },
  { value: "20M+", label: "likes" },
  { value: "800K+", label: "followers" },
];

const SOCIAL_ICONS: Record<string, typeof Github> = { GitHub: Github, LinkedIn: Linkedin, TikTok: Video };

// Grid footprint per site (3-column grid on desktop, 2 on tablet).
const LAYOUT: Record<string, string> = {
  "/portfolio": "sm:col-span-2 lg:row-span-2 min-h-[22rem]",
};

// Decorative artwork behind each card. Purely visual (aria-hidden).
const ART: Record<string, ReactNode> = {
  "/portfolio": (
    <img
      src="/bcu.png"
      alt=""
      className="absolute -bottom-24 -right-20 w-[30rem] max-w-none rotate-[-8deg] opacity-[0.28] grayscale [mask-image:linear-gradient(to_top_left,black_35%,transparent_80%)] [.theme-light_&]:invert"
    />
  ),
  "/travel": (
    <svg viewBox="0 0 200 120" className="absolute right-12 top-3 w-44 text-brand opacity-50">
      <path d="M12 100 Q 90 -10 188 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
      <circle cx="12" cy="100" r="3.5" fill="currentColor" />
      <circle cx="188" cy="40" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="188" cy="40" r="9" fill="none" stroke="currentColor" strokeOpacity="0.3" />
    </svg>
  ),
  "/drunk": (
    <img
      src="/drunk_logo.png"
      alt=""
      className="absolute right-8 top-1 w-36 rotate-12 opacity-25 mix-blend-screen [mask-image:radial-gradient(circle,black_45%,transparent_68%)] [.theme-light_&]:invert [.theme-light_&]:mix-blend-multiply"
    />
  ),
  "/finance": (
    <div className="absolute right-16 top-7 flex h-10 items-end gap-1 opacity-60">
      {[35, 55, 45, 70, 60, 85].map((h, i) => (
        <span
          key={i}
          className="w-2 rounded-t-sm bg-foreground/15"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  ),
};

const PORTFOLIO_TAGS = ["Solar car", "LiquorBot", "Embedded", "Video"];

const rise = (i: number): CSSProperties => ({ animationDelay: `${i * 70}ms` });

const SiteCard = ({ site }: { site: Site }) => {
  const { path, name, description, icon: Icon, locked, group } = site;
  const featured = path === "/portfolio";
  const { guard } = useUnlock();

  return (
    <Link
      to={path}
      onClick={guard(path)}
      className="group relative isolate flex h-full flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-6 shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] transition duration-300 hover:-translate-y-0.5 hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {ART[path]}
      </div>

      <div className="flex items-start justify-between">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
          <Icon className="h-5 w-5" />
        </span>
        <ArrowUpRight className="h-5 w-5 text-muted-foreground transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" />
      </div>

      <div className="mt-auto pt-4">
        {group === "tools" && (
          <span className="mb-2 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
            Tool
            {locked && <Lock className="h-3 w-3" aria-label="Password protected" />}
          </span>
        )}
        <h3 className={cn("font-display font-semibold tracking-tight", featured ? "text-3xl sm:text-4xl" : "text-xl")}>
          {name}
        </h3>
        <p className={cn("mt-1.5 text-sm text-muted-foreground", featured && "max-w-sm sm:text-base")}>{description}</p>
        {featured && (
          <ul className="mt-5 flex flex-wrap gap-2">
            {PORTFOLIO_TAGS.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-foreground/10 bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Link>
  );
};

// ThermaTech: external link, styled like the other site cards.
const CompanyCard = () => (
  <a
    href={COMPANY.href}
    target="_blank"
    rel="noopener noreferrer"
    className="group relative isolate flex h-full flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-6 shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] transition duration-300 hover:-translate-y-0.5 hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
  >
    <img
      src={COMPANY.image}
      alt=""
      aria-hidden
      loading="lazy"
      className="pointer-events-none absolute -z-10 hidden opacity-90 sm:-bottom-14 sm:right-8 sm:block sm:w-64"
    />

    <div className="flex items-start justify-between">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
        <span
          aria-hidden
          className="h-5 w-5 bg-current"
          style={{ WebkitMask: `url("${COMPANY.icon}") center / contain no-repeat`, mask: `url("${COMPANY.icon}") center / contain no-repeat` }}
        />
      </span>
      <ArrowUpRight className="h-5 w-5 text-muted-foreground transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" />
    </div>

    <div className="mt-auto pt-4 sm:max-w-[52%]">
      <span className="mb-2 inline-flex text-[11px] uppercase tracking-widest text-muted-foreground">{COMPANY.role}</span>
      <h3 className="font-display text-xl font-semibold tracking-tight">{COMPANY.name}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{COMPANY.description}</p>
    </div>
  </a>
);

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const Home = () => {
  useEffect(() => {
    document.title = DEFAULT_TITLE;
    const favicon = document.querySelector("link[rel='icon']");
    if (favicon) favicon.setAttribute("href", "/logo.png");
  }, []);

  return (
    <div className="relative isolate overflow-hidden">
      {/* Ambient background: fading grid, film grain. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--foreground)/0.05)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground)/0.05)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,black,transparent)]" />
        <div className="absolute inset-0 opacity-[0.035] mix-blend-overlay" style={{ backgroundImage: NOISE }} />
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 sm:pt-24">
        {/* Hero: intro on the left, stats panel on the right (stacks on mobile). */}
        <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-end lg:gap-16">
          <div className="min-w-0">
            <p
              className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground motion-safe:animate-rise"
              style={rise(0)}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand shadow-[0_0_10px_hsl(var(--brand))]" />
              Founder &amp; CTO · Electrical Engineer · Creator
            </p>
            <h1
              className="mt-4 bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text pb-2 font-display text-6xl font-bold leading-[0.95] tracking-tight text-transparent sm:text-7xl lg:text-8xl motion-safe:animate-rise"
              style={rise(1)}
            >
              nathanham
              <br />
              .tech
            </h1>
            <div className="mt-8 flex flex-wrap gap-2 motion-safe:animate-rise" style={rise(3)}>
              {SOCIAL_LINKS.map(({ name, href }) => {
                const Icon = SOCIAL_ICONS[name] ?? ArrowUpRight;
                return (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.03] px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <Icon className="h-4 w-4" />
                    {name}
                  </a>
                );
              })}
            </div>
          </div>

          <dl
            className="grid grid-cols-3 divide-x divide-foreground/10 rounded-2xl border border-foreground/10 bg-foreground/[0.03] shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] lg:grid-cols-1 lg:divide-x-0 lg:divide-y motion-safe:animate-rise"
            style={rise(4)}
          >
            {STATS.map(({ value, label }) => (
              <div
                key={label}
                className="flex flex-col-reverse px-4 py-5 text-center lg:flex-row-reverse lg:items-baseline lg:justify-between lg:px-6 lg:py-6 lg:text-left"
              >
                <dt className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground lg:mt-0">{label}</dt>
                <dd className="font-display text-2xl font-bold tracking-tight sm:text-4xl">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Sites */}
        <section className="mt-20" aria-labelledby="explore">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 id="explore" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <span className="text-brand">//</span> Explore
            </h2>
            <span className="text-xs text-muted-foreground">{SITES.length} sites</span>
          </div>
          <ul className="grid grid-flow-dense auto-rows-[minmax(13rem,auto)] gap-4 lg:auto-rows-[13rem] sm:grid-cols-2 lg:grid-cols-3">
            {SITES.map((site, i) => (
              <li key={site.path} className={cn("motion-safe:animate-rise", LAYOUT[site.path])} style={rise(6 + i)}>
                <SiteCard site={site} />
              </li>
            ))}
            <li className="motion-safe:animate-rise sm:col-span-2" style={rise(6 + SITES.length)}>
              <CompanyCard />
            </li>
          </ul>
        </section>

        {/* Brands */}
        <section className="mt-24" aria-labelledby="brands">
          <h2 id="brands" className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Brands I've worked with
          </h2>
          <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
            <div className="flex w-max motion-safe:animate-scroll-brands">
              {[...BRANDS, ...BRANDS].map((brand, i) => (
                <div key={i} className="flex h-20 items-center px-7" aria-hidden={i >= BRANDS.length}>
                  <BrandLogo
                    brand={brand}
                    className="text-foreground/80"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Home;
