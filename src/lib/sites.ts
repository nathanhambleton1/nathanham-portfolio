// Single source of truth for every site hosted under nathanham.tech.
//
// The home screen at "/" is generated from this list, and App.tsx mounts each
// site at its `path`. To add a new site: add its route in App.tsx and an entry
// here — nothing else needs to know about it.

import type { LucideIcon } from "lucide-react";
import { Briefcase, Beer, Plane, Wallet } from "lucide-react";

export type SiteGroup = "main" | "tools";

export interface Site {
  /** Route the site is mounted at (no trailing slash). */
  path: string;
  name: string;
  description: string;
  icon: LucideIcon;
  group: SiteGroup;
  /** Shown with a lock badge on the home screen. */
  locked?: boolean;
}

export const SITES: Site[] = [
  {
    path: "/portfolio",
    name: "Portfolio",
    description: "Projects, experience and skills.",
    icon: Briefcase,
    group: "main",
  },
  {
    path: "/travel",
    name: "Our Travels",
    description: "Trips, a map and the glass collection.",
    icon: Plane,
    group: "main",
  },
  {
    path: "/drunk",
    name: "Games",
    description: "Drunkopoly, blackjack, beer pong, power hour and more.",
    icon: Beer,
    group: "main",
  },
  {
    path: "/finance",
    name: "Finance",
    description: "Paychecks, bills, savings, taxes and PTO.",
    icon: Wallet,
    group: "tools",
    locked: true,
  },
];

export const SITE_GROUPS: { key: SiteGroup; label: string }[] = [
  { key: "main", label: "Sites" },
  { key: "tools", label: "Tools" },
];

export const DEFAULT_TITLE = "Nathan Hambleton";

// Nathan's company (Founder & CTO). Featured on the home page and linked in the footer.
export const COMPANY = {
  name: "ThermaTech Innovations",
  role: "Founder & CTO",
  href: "https://thermatechnology.com/",
  description: "Smart HVAC monitoring and predictive maintenance.",
  /** One-color cutout of the logo, tinted with the theme accent like the other card icons. */
  icon: "/therma/icon-mask.png",
  image: "/therma/render.png",
};

export const SOCIAL_LINKS: { name: string; href: string }[] = [
  { name: "GitHub", href: "https://github.com/nathanhambleton1" },
  { name: "LinkedIn", href: "https://www.linkedin.com/in/nathanhambleton/" },
  { name: "TikTok", href: "https://www.tiktok.com/@nathan_ham" },
];
