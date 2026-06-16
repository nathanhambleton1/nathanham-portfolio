// Coverflow-style album: the active polaroid sits front-and-center while the
// neighbouring photos peek out behind it on each side. Drag / swipe or use the
// arrows to cycle; it wraps around infinitely in both directions.
//
// Photos keep their natural aspect ratio — we don't crop them. Each one is just
// normalised into a consistent bounding box (max width + max height) so a tiny
// image and a huge one render at roughly the same on-screen size, and the
// polaroid frame hugs whatever shape the photo actually is.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface CarouselSlide {
  id: string;
  url: string;
  caption?: string | null;
}

interface Props {
  slides: CarouselSlide[];
  alt: string;
  index: number;
  onIndexChange: (next: number) => void;
}

export default function PhotoCarousel({ slides, alt, index, onIndexChange }: Props) {
  const n = slides.length;
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(0);

  // Measure the stage so the side photos peek by a consistent pixel amount,
  // regardless of each photo's own (now variable) width.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setStageW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const step = Math.min(Math.max(stageW * 0.2, 64), 110);

  const go = useCallback(
    (dir: number) => {
      if (n === 0) return;
      onIndexChange((((index + dir) % n) + n) % n);
    },
    [index, n, onIndexChange]
  );

  // Arrow-key navigation.
  useEffect(() => {
    if (n <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, n]);

  if (n === 0) return null;

  return (
    <div className="relative w-full select-none">
      {/* Stage — overflow visible so the side polaroids peek out. */}
      <div
        ref={stageRef}
        className="relative mx-auto h-[clamp(360px,66vh,580px)] w-full max-w-2xl"
        style={{ perspective: 1800 }}
      >
        {slides.map((s, i) => {
          // Circular distance from the active card so it wraps both ways.
          let d = i - index;
          if (d > n / 2) d -= n;
          if (d < -n / 2) d += n;
          const abs = Math.abs(d);
          const isFront = d === 0;
          const visible = abs <= 2;
          // Sub-linear offset: each card behind sits only a little further out
          // than the last, so the stack piles up tightly instead of fanning.
          const offset = Math.sign(d) * step * (abs === 0 ? 0 : 1 + (abs - 1) * 0.5);
          // Deterministic little tilt so the stacked cards feel scattered on a
          // table; the focused card straightens out to 0.
          const tilt = ((i * 7) % 9) - 4;

          return (
            // Outer: positions the card's centre point along the stage (px
            // offsets keep peek spacing even across mixed widths).
            <motion.div
              key={s.id}
              className="absolute left-1/2 top-1/2"
              style={{ pointerEvents: visible ? "auto" : "none" }}
              animate={{
                x: offset,
                opacity: visible ? (abs === 0 ? 1 : abs === 1 ? 0.92 : 0.4) : 0,
                zIndex: 100 - abs,
              }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
            >
              {/* Middle: static centring on that point (own size, both axes). */}
              <div className="-translate-x-1/2 -translate-y-1/2">
                {/* Inner: the 3D tilt + scale, and the drag target up front. */}
                <motion.div
                  style={{
                    transformStyle: "preserve-3d",
                    backfaceVisibility: "hidden",
                    willChange: "transform",
                    cursor: isFront ? "grab" : "pointer",
                  }}
                  animate={{
                    scale: visible ? 1 - abs * 0.1 : 0.6,
                    rotateY: -d * 18,
                    rotateZ: isFront ? 0 : tilt,
                    filter: isFront ? "brightness(1)" : "brightness(0.9)",
                  }}
                  transition={{ type: "spring", stiffness: 260, damping: 30 }}
                  drag={isFront && n > 1 ? "x" : false}
                  dragSnapToOrigin
                  dragElastic={0.18}
                  whileTap={isFront ? { cursor: "grabbing" } : undefined}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -55 || info.velocity.x < -450) go(1);
                    else if (info.offset.x > 55 || info.velocity.x > 450) go(-1);
                  }}
                  onClick={() => {
                    if (!isFront) go(d > 0 ? 1 : -1);
                  }}
                >
                  <div className="tv-polaroid">
                    <img
                      src={s.url}
                      alt={s.caption ?? alt}
                      draggable={false}
                      className="block rounded-[2px] bg-[var(--tv-paper-2)]"
                      style={{
                        width: "auto",
                        height: "auto",
                        maxWidth: "min(72vw, 340px)",
                        maxHeight: "clamp(240px, 48vh, 430px)",
                      }}
                    />
                    {/* Always render the bottom lip so every photo reads as a
                        polaroid, captioned or not. */}
                    <div
                      className="tv-polaroid__caption tv-handwritten text-2xl"
                      style={{ minHeight: "2.75rem" }}
                    >
                      {s.caption}
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {n > 1 && (
        <>
          {/* Arrows */}
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous photo"
            className="tv-btn absolute left-1 top-[44%] z-[200] grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-[var(--tv-card)] text-[var(--tv-ink)] shadow-md hover:bg-[var(--tv-accent)] hover:text-white sm:left-3"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next photo"
            className="tv-btn absolute right-1 top-[44%] z-[200] grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-[var(--tv-card)] text-[var(--tv-ink)] shadow-md hover:bg-[var(--tv-accent)] hover:text-white sm:right-3"
          >
            <ChevronRight size={20} />
          </button>

          {/* Dots */}
          <div className="mt-3 flex items-center justify-center gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to photo ${i + 1}`}
                onClick={() => onIndexChange(i)}
                className={`h-2 rounded-full transition-all ${
                  i === index
                    ? "w-6 bg-[var(--tv-accent)]"
                    : "w-2 bg-[rgba(58,47,40,0.25)] hover:bg-[rgba(58,47,40,0.45)]"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
