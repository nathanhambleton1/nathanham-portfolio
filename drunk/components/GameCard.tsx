import type { ReactNode } from "react";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface GameCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  path: string;
  /** Larger title/description and tag chips (used for the hero tile). */
  featured?: boolean;
  tags?: string[];
  /** Decorative artwork rendered behind the card content. */
  art?: ReactNode;
}

// Same card treatment as the site cards on the home page.
export const GameCard = ({ title, description, icon: Icon, path, featured, tags, art }: GameCardProps) => (
  <Link
    to={path}
    className="group relative isolate flex h-full flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-6 shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] transition duration-300 hover:-translate-y-0.5 hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
  >
    {art && (
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {art}
      </div>
    )}

    <div className="flex items-start justify-between">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
        <Icon className="h-5 w-5" />
      </span>
      <ArrowUpRight className="h-5 w-5 text-muted-foreground transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" />
    </div>

    <div className="mt-auto pt-4">
      <h3 className={cn("font-display font-semibold tracking-tight", featured ? "text-3xl sm:text-4xl" : "text-xl")}>
        {title}
      </h3>
      <p className={cn("mt-1.5 text-sm text-muted-foreground", featured && "max-w-sm sm:text-base")}>{description}</p>
      {featured && tags && (
        <ul className="mt-5 flex flex-wrap gap-2">
          {tags.map((tag) => (
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
