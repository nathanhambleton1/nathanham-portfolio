import React, { useEffect, useMemo, useState } from "react";
import { useIsMobile } from "../hooks/use-mobile";

/**
 * ArcRailNavigation v2
 * - Right edge locked (perfect alignment regardless of label length)
 * - Stronger taper (power curve)
 * - Far items shrink + darken smoothly
 */

const CONFIG = {
  itemGap: 38,         // vertical spacing
  curve: 48,           // horizontal offset (px) for far items - reduced for a subtler "wheel" look
  maxNeighbors: 8,     // items above/below to render
  taperPower: 2.1,     // >1 = steeper taper (reduced from 2.1)
  scaleMin: 0,      // min scale for far items
  labelMinOpacity: 0, // min label opacity (rgba)
  railWidth: 140,  // wider to accommodate left-aligned labels
  itemGapMin: -50,    // minimum vertical spacing when far from center
};

const NAV_ITEMS = [
  { id: "about", label: "About" },
  { id: "experience", label: "Experience" },
  { id: "solar-car", label: "Solar Car" },
  { id: "liquorbot", label: "LiquorBot" },
  { id: "marketing", label: "Marketing" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects" },
  { id: "college", label: "College" },
];

export default function ArcRailNavigation() {
  const isMobile = useIsMobile();
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
  // Positive -> move right from the left-anchored rail. Smaller values give a more vertical
  // appearance (less arcing). Uses a power taper so distance feels natural.
  // No horizontal offset: keep everything left-anchored
  const leftOffset = (_absDist: number) => 0;

  // Scale: 1 at center → scaleMin at far
  const scaleAt = (absDist: number) =>
    1 - (1 - CONFIG.scaleMin) * u(absDist);

  // Label opacity only (container opacity stays 1 for crisp transform)
  const labelOpacityAt = (absDist: number) =>
    1 - (1 - CONFIG.labelMinOpacity) * u(absDist);

  // Step gap (vertical) between successive items: larger near center, smaller far away
  const stepGapAt = (absDist: number) =>
    CONFIG.itemGapMin + (CONFIG.itemGap - CONFIG.itemGapMin) * (1 - u(absDist));

  // Cumulative vertical offset for item at distance `d` (can be negative). We sum
  // the successive step gaps so items compress smoothly as they get further away.
  const cumulativeGap = (d: number) => {
    const sign = Math.sign(d) || 1;
    const n = Math.abs(d);
    let s = 0;
    for (let k = 0; k < n; k++) s += stepGapAt(k);
    return s * sign;
  };

  return (
    !isMobile && (
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
              // Center the active item vertically in the container, using cumulative
              // gaps so spacing shrinks the further away an item is.
              const y = centerY + cumulativeGap(d);
              const s = scaleAt(abs);
              const lblOpacity = labelOpacityAt(abs);
              const isActive = i === activeIndex;

              return (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  aria-current={isActive ? "true" : undefined}
                  className="absolute left-0 outline-none"
                    style={{
                      transformOrigin: "0 50%", // lock to left edge
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
                          "font-mono tracking-wide whitespace-nowrap text-left " +
                          (isActive ? "text-white font-semibold" : "font-normal")
                      }
                      style={{
                        // darker as it fades off
                        color: `rgba(255,255,255,${lblOpacity.toFixed(3)})`,
                        // small base-size bump on active; scale does the rest
                        fontSize: isActive ? "0.85rem" : "0.7rem",
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
    )
  );
}
