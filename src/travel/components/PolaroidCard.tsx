// The signature scrapbook card: a polaroid with tape, a photo, and a
// handwritten caption. Used in the gallery, trips, and timeline.

import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import type { GlassWithDetails } from "../lib/types";
import { formatDate } from "../lib/format";

interface Props {
  glass: GlassWithDetails;
  onClick?: () => void;
  index?: number;
}

// Deterministic tilt per card (no Math.random — keeps SSR/build stable).
function tiltFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const tilts = [-3, -2, -1.5, 1.5, 2, 3];
  return tilts[Math.abs(h) % tilts.length];
}

export default function PolaroidCard({ glass, onClick, index = 0 }: Props) {
  const cover = glass.glass_url ?? glass.photos[0]?.url ?? null;
  const tilt = tiltFor(glass.id);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="tv-polaroid block w-full text-left"
      style={{ rotate: `${tilt}deg` }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.4) }}
    >
      <span className="tv-tape" aria-hidden />
      {cover ? (
        <img src={cover} alt={glass.location_name} className="tv-polaroid__img" loading="lazy" />
      ) : (
        <div className="tv-polaroid__img grid place-items-center text-5xl">🥃</div>
      )}
      <div className="tv-polaroid__caption">
        <div className="tv-handwritten text-2xl leading-tight text-[var(--tv-ink)]">
          {glass.location_name}
        </div>
        <div className="mt-1 flex items-center justify-center gap-1 text-xs text-[var(--tv-ink-soft)]">
          {glass.place_detail && (
            <>
              <MapPin size={12} />
              <span className="truncate">{glass.place_detail}</span>
            </>
          )}
        </div>
        {glass.collected_at && (
          <div className="tv-handwritten mt-0.5 text-base text-[var(--tv-accent)]">
            {formatDate(glass.collected_at)}
          </div>
        )}
        {glass.trip && (
          <div className="mt-1 inline-block rounded-full bg-[var(--tv-paper-2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--tv-ink-soft)]">
            {glass.trip.name}
          </div>
        )}
      </div>
    </motion.button>
  );
}
