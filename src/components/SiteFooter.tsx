import { Link } from "react-router-dom";
import { useUnlock } from "./UnlockProvider";
import { COMPANY, SITES, SITE_GROUPS, SOCIAL_LINKS } from "@/lib/sites";

const SiteFooter = () => {
  const { guard } = useUnlock();
  return (
  <footer className="border-t border-border bg-background">
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:grid-cols-2 md:grid-cols-4">
      <div className="sm:col-span-2 md:col-span-1">
        <Link to="/" className="flex items-center gap-3 font-semibold">
          <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg" />
          Nathan Hambleton
        </Link>
        <p className="mt-3 text-sm text-muted-foreground">
          Electrical Engineer | Product Development | Video Creator
        </p>
      </div>

      {SITE_GROUPS.map((group) => (
        <div key={group.key}>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{group.label}</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {SITES.filter((s) => s.group === group.key).map((site) => (
              <li key={site.path}>
                <Link to={site.path} onClick={guard(site.path)} className="text-muted-foreground transition-colors hover:text-foreground">
                  {site.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Elsewhere</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {[{ name: COMPANY.name, href: COMPANY.href }, ...SOCIAL_LINKS].map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>

    <div className="border-t border-border">
      <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted-foreground sm:px-6">
        © {new Date().getFullYear()} Nathan Hambleton. All rights reserved.
      </p>
    </div>
  </footer>
  );
};

export default SiteFooter;
