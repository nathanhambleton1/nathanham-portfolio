import React, { useEffect, useMemo, useState } from "react";

/**
 * ArcRailNavigation v2
 * - Right edge locked (perfect alignment regardless of label length)
 * - Stronger taper (power curve)
 * - Far items shrink + darken smoothly
 */

const CONFIG = {
  itemGap: 38,         // vertical spacing
  curve: 220,          // max leftward offset (px) for far items (reduced from 600)
  maxNeighbors: 8,     // items above/below to render
  taperPower: 1.5,     // >1 = steeper taper (reduced from 2.1)
  scaleMin: 0.1,      // min scale for far items
  labelMinOpacity: 0.1, // min label opacity (rgba)
  railWidth: 180,  // 18rem
};

const NAV_ITEMS = [
  { id: "about", label: "About" },
  { id: "college", label: "College" },
  { id: "solar-car", label: "Solar Car" },
  { id: "liquorbot", label: "LiquorBot" },
  { id: "brands", label: "Brands" },
  { id: "projects", label: "Projects" },
];

export default function ArcRailNavigation() {
  const [activeId, setActiveId] = useState<string>(NAV_ITEMS[0].id);

  const activeIndex = useMemo(() => {
    const idx = NAV_ITEMS.findIndex((n) => n.id === activeId);
    return idx < 0 ? 0 : idx;
  }, [activeId]);

  // Active item = section nearest viewport center
  useEffect(() => {
    let ticking = false;
    const update = () => {
      const vpCenter = window.innerHeight / 2;
      let bestId = activeId, best = Infinity;
      for (const it of NAV_ITEMS) {
        const el = document.getElementById(it.id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const d = Math.abs((r.top + r.height / 2) - vpCenter);
        if (d < best) { best = d; bestId = it.id; }
      }
      if (bestId !== activeId) setActiveId(bestId);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { update(); ticking = false; });
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [activeId]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const sectionCenter = el.offsetTop + el.offsetHeight / 2;
    const target = Math.max(
      0,
      Math.min(
        sectionCenter - window.innerHeight / 2,
        document.documentElement.scrollHeight - window.innerHeight
      )
    );
    window.scrollTo({ top: target, behavior: "smooth" });
  };

  // 0..1 distance factor
  const u = (absDist: number) =>
    Math.min(1, absDist / CONFIG.maxNeighbors);

  // Stronger taper using a power curve
  const leftOffset = (absDist: number) =>
    -CONFIG.curve * Math.pow(u(absDist), CONFIG.taperPower);

  // Scale: 1 at center → scaleMin at far
  const scaleAt = (absDist: number) =>
    1 - (1 - CONFIG.scaleMin) * u(absDist);

  // Label opacity only (container opacity stays 1 for crisp transform)
  const labelOpacityAt = (absDist: number) =>
    1 - (1 - CONFIG.labelMinOpacity) * u(absDist);

  return (
    <nav
      aria-label="Section navigation"
      className="pointer-events-auto fixed left-6 top-1/2 -translate-y-1/2 z-40 select-none"
      style={{ width: `${CONFIG.railWidth}px` }}
      role="navigation"
    >
      <div className="relative h-[60vh] w-full">
        {(() => {
          // Center the active item in the container
          const containerHeight = 0.6 * window.innerHeight; // 60vh
          const centerY = containerHeight / 2;
          return NAV_ITEMS.map((item, i) => {
            const d = i - activeIndex;
            const abs = Math.abs(d);
            if (abs > CONFIG.maxNeighbors) return null;

            const x = leftOffset(abs);
            // Center the active item vertically in the container
            const y = centerY + d * CONFIG.itemGap;
            const s = scaleAt(abs);
            const lblOpacity = labelOpacityAt(abs);
            const isActive = i === activeIndex;

            return (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                aria-current={isActive ? "true" : undefined}
                className="absolute right-0 outline-none"
                style={{
                  transformOrigin: "100% 50%", // lock to right edge
                  transform: `translate3d(${x}px, ${y - 20}px, 0) scale(${s})`, // -20 to roughly center vertically (button height compensation)
                  transition:
                    "transform 320ms cubic-bezier(.2,.8,.2,1), color 180ms ease",
                  willChange: "transform",
                  zIndex: 1000 - abs,
                }}
              >
                <div className="flex items-center gap-3">
                  {/* dot (kept fairly consistent; subtle size change via scale) */}
                  <span
                    className={
                      "block rounded-full transition-all duration-300 " +
                      (isActive ? "h-2 w-2 bg-white" : "h-1.5 w-1.5 bg-white/60")
                    }
                  />
                  {/* label: right-aligned, no-wrap, darkens with distance */}
                  <span
                    className={
                      "font-mono tracking-wide whitespace-nowrap text-right " +
                      (isActive ? "text-white font-semibold" : "font-normal")
                    }
                    style={{
                      // darker as it fades off
                      color: `rgba(255,255,255,${lblOpacity.toFixed(3)})`,
                      // small base-size bump on active; scale does the rest
                      fontSize: isActive ? "1.125rem" : "1rem",
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              </button>
            );
          });
        })()}
      </div>
    </nav>
  );
}
