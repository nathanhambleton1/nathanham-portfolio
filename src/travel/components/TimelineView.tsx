// Chronological "journey" view: a vertical timeline grouped by year.

import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import type { GlassWithDetails } from "../lib/types";
import { formatDate, getYear } from "../lib/format";

interface Props {
  glasses: GlassWithDetails[];
  onSelect: (g: GlassWithDetails) => void;
}

export default function TimelineView({ glasses, onSelect }: Props) {
  // Newest first; undated entries sink to the bottom.
  const sorted = [...glasses].sort((a, b) => {
    const ta = a.collected_at ? Date.parse(a.collected_at) : -Infinity;
    const tb = b.collected_at ? Date.parse(b.collected_at) : -Infinity;
    return tb - ta;
  });

  if (sorted.length === 0)
    return (
      <p className="tv-handwritten py-10 text-center text-2xl text-[var(--tv-ink-soft)]">
        Add a memory to start your timeline ✨
      </p>
    );

  let lastYear: string | null = null;

  return (
    <div className="relative mx-auto max-w-3xl py-4 pl-12 md:pl-0">
      <div className="tv-timeline-rail" aria-hidden />
      {sorted.map((g, i) => {
        const year = getYear(g.collected_at);
        const showYear = year !== lastYear;
        lastYear = year;
        const side = i % 2 === 0; // alternate sides on desktop
        return (
          <div key={g.id}>
            {showYear && (
              <div className="relative my-6 flex md:justify-center">
                <span className="tv-display rounded-full bg-[var(--tv-ink)] px-4 py-1 text-2xl text-[var(--tv-paper)]">
                  {year ?? "Someday"}
                </span>
              </div>
            )}
            <motion.div
              initial={{ opacity: 0, x: side ? -24 : 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.4 }}
              className={`relative mb-6 md:w-1/2 ${
                side ? "md:pr-10" : "md:ml-auto md:pl-10"
              }`}
            >
              <span
                className="absolute top-4 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-[var(--tv-paper)] bg-[var(--tv-accent)] md:left-auto md:right-0 md:translate-x-1/2"
                style={{ left: "-32px" }}
                aria-hidden
              />
              <button
                type="button"
                onClick={() => onSelect(g)}
                className="tv-polaroid !p-3 flex w-full items-center gap-3 text-left"
                style={{ rotate: "0deg" }}
              >
                {(g.photos[0]?.url ?? g.glass_url) ? (
                  <img
                    src={g.photos[0]?.url ?? g.glass_url ?? ""}
                    alt={g.location_name}
                    className="h-16 w-16 flex-shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="grid h-16 w-16 flex-shrink-0 place-items-center rounded bg-[var(--tv-paper-2)] text-3xl">
                    🥃
                  </div>
                )}
                <div className="min-w-0">
                  <div className="tv-handwritten text-xl leading-tight">
                    {g.location_name}
                  </div>
                  {g.place_detail && (
                    <div className="flex items-center gap-1 text-xs text-[var(--tv-ink-soft)]">
                      <MapPin size={11} /> {g.place_detail}
                    </div>
                  )}
                  {g.collected_at && (
                    <div className="text-xs text-[var(--tv-accent)]">
                      {formatDate(g.collected_at)}
                    </div>
                  )}
                </div>
              </button>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
