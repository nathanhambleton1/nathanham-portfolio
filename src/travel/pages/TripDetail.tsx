// A single trip: header + its glasses as a gallery.

import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { useGlasses, useTrips } from "../lib/queries";
import { useEditMode } from "../context/EditMode";
import { formatDateRange } from "../lib/format";
import GalleryView from "../components/GalleryView";
import GlassEditor from "../components/GlassEditor";
import TripEditor from "../components/TripEditor";

export default function TripDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: glasses = [], isLoading } = useGlasses();
  const { data: trips = [] } = useTrips();
  const { unlocked } = useEditMode();
  const [addingGlass, setAddingGlass] = useState(false);
  const [editingTrip, setEditingTrip] = useState(false);

  const trip = trips.find((t) => t.id === id);
  const tripGlasses = useMemo(
    () => glasses.filter((g) => g.trip_id === id),
    [glasses, id]
  );

  if (isLoading)
    return <p className="py-20 text-center text-[var(--tv-ink-soft)]">Loading…</p>;

  if (!trip)
    return (
      <div className="py-20 text-center">
        <p className="tv-handwritten text-3xl">Trip not found</p>
        <button
          onClick={() => navigate("/travel")}
          className="mt-3 text-[var(--tv-accent)] underline"
        >
          Back to all
        </button>
      </div>
    );

  const accent = trip.color ?? "var(--tv-accent)";

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6">
      <button
        onClick={() => navigate("/travel")}
        className="tv-btn mb-4 inline-flex items-center gap-1 text-[var(--tv-ink-soft)] hover:text-[var(--tv-accent)]"
      >
        <ArrowLeft size={16} /> All travels
      </button>

      {trip.cover_url && (
        <div className="tv-polaroid mx-auto mb-6 max-w-3xl" style={{ rotate: "0deg" }}>
          <img
            src={trip.cover_url}
            alt={trip.name}
            className="h-56 w-full rounded object-cover"
          />
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="tv-handwritten text-6xl leading-none" style={{ color: accent }}>
            {trip.name}
          </h1>
          <div className="mt-1 text-sm text-[var(--tv-ink-soft)]">
            {formatDateRange(trip.start_date, trip.end_date)} · {tripGlasses.length}{" "}
            glass{tripGlasses.length === 1 ? "" : "es"}
          </div>
          {trip.description && (
            <p className="mt-2 max-w-xl text-[var(--tv-ink)]">{trip.description}</p>
          )}
        </div>
        {unlocked && (
          <div className="flex gap-2">
            <button
              onClick={() => setEditingTrip(true)}
              className="tv-btn inline-flex items-center gap-1 border-2 border-[rgba(58,47,40,0.18)] px-3 py-1.5 text-sm"
            >
              <Pencil size={14} /> Edit trip
            </button>
            <button
              onClick={() => setAddingGlass(true)}
              className="tv-btn inline-flex items-center gap-1 bg-[var(--tv-accent)] px-3 py-1.5 text-sm text-white"
            >
              <Plus size={15} /> Add glass
            </button>
          </div>
        )}
      </div>

      <div className="mt-8">
        <GalleryView
          glasses={tripGlasses}
          onSelect={(g) => navigate(`/travel/glass/${g.id}`)}
        />
      </div>

      <GlassEditor
        open={addingGlass}
        onOpenChange={setAddingGlass}
        trips={trips}
        defaultTripId={trip.id}
      />
      <TripEditor open={editingTrip} onOpenChange={setEditingTrip} trip={trip} />
    </div>
  );
}
