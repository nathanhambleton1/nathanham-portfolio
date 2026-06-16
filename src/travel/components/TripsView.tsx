// Trips shown as scrapbook "albums".

import { motion } from "framer-motion";
import { Pencil } from "lucide-react";
import type { GlassWithDetails, Trip } from "../lib/types";
import { formatDateRange } from "../lib/format";

interface Props {
  trips: Trip[];
  glasses: GlassWithDetails[];
  onOpenTrip: (trip: Trip) => void;
  canEdit: boolean;
  onEditTrip: (trip: Trip) => void;
}

export default function TripsView({
  trips,
  glasses,
  onOpenTrip,
  canEdit,
  onEditTrip,
}: Props) {
  if (trips.length === 0)
    return (
      <p className="tv-handwritten py-10 text-center text-2xl text-[var(--tv-ink-soft)]">
        No trips yet — group your glasses into adventures 🧳
      </p>
    );

  const countFor = (tripId: string) =>
    glasses.filter((g) => g.trip_id === tripId).length;
  const coverFor = (trip: Trip) =>
    trip.cover_url ??
    glasses.find((g) => g.trip_id === trip.id && (g.photos[0]?.url ?? g.glass_url))
      ?.photos[0]?.url ??
    glasses.find((g) => g.trip_id === trip.id && g.glass_url)?.glass_url ??
    null;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {trips.map((trip, i) => {
        const cover = coverFor(trip);
        const accent = trip.color ?? "var(--tv-accent)";
        return (
          <motion.div
            key={trip.id}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.3) }}
            className="relative"
          >
            <button
              type="button"
              onClick={() => onOpenTrip(trip)}
              className="tv-polaroid block w-full overflow-hidden text-left"
              style={{ rotate: "0deg" }}
            >
              <span className="tv-tape tv-tape--tl" aria-hidden />
              {cover ? (
                <img
                  src={cover}
                  alt={trip.name}
                  className="h-44 w-full rounded object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="grid h-44 w-full place-items-center rounded bg-[var(--tv-paper-2)] text-5xl">
                  🧳
                </div>
              )}
              <div className="px-1 py-3">
                <div className="tv-handwritten text-3xl leading-none" style={{ color: accent }}>
                  {trip.name}
                </div>
                <div className="mt-1 text-xs text-[var(--tv-ink-soft)]">
                  {formatDateRange(trip.start_date, trip.end_date)}
                </div>
                <div className="mt-1 text-sm font-semibold text-[var(--tv-ink)]">
                  {countFor(trip.id)} glass
                  {countFor(trip.id) === 1 ? "" : "es"}
                </div>
              </div>
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={() => onEditTrip(trip)}
                className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[var(--tv-ink)] shadow"
                title="Edit trip"
              >
                <Pencil size={14} />
              </button>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
