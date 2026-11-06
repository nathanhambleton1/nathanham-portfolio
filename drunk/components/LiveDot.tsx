import { cn } from "@/lib/utils";

/** A small green "live" status dot with a soft repeating ping. */
export const LiveDot = ({ className }: { className?: string }) => (
  <span aria-hidden className={cn("relative inline-flex h-2 w-2 shrink-0", className)}>
    <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-70 motion-safe:animate-ping" />
    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
  </span>
);
