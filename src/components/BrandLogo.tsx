import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { Brand } from "@/lib/brands";

interface BrandLogoProps {
  brand: Brand;
  /** Visual weight in px²: wide wordmarks get shorter, square marks taller, so they all read the same size. */
  area?: number;
  className?: string;
}

// Renders a logo cutout as a CSS mask filled with `currentColor`, so it always
// matches the active theme (set the color with a text-* class).
const BrandLogo = ({ brand, area = 3600, className }: BrandLogoProps) => {
  const width = Math.round(Math.sqrt(area * brand.ratio));
  const height = Math.round(Math.sqrt(area / brand.ratio));
  const mask = `url("${brand.src}") center / contain no-repeat`;
  const style: CSSProperties = { width, height, WebkitMask: mask, mask };

  return <span role="img" aria-label={brand.name} className={cn("block shrink-0 bg-current", className)} style={style} />;
};

export default BrandLogo;
