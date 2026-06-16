// Single location: photo album, story, date, trip link, mini-map.

import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, MapPin, Pencil } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useGlasses, useTrips } from "../lib/queries";
import { useEditMode } from "../context/EditMode";
import { formatDateTime } from "../lib/format";
import MapView from "../components/MapView";
import GlassEditor from "../components/GlassEditor";

export default function GlassDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: glasses = [], isLoading } = useGlasses();
  const { data: trips = [] } = useTrips();
  const { unlocked } = useEditMode();
  const [editing, setEditing] = useState(false);

  const glass = glasses.find((g) => g.id === id);

  if (isLoading)
    return <p className="py-20 text-center text-[var(--tv-ink-soft)]">Loading…</p>;

  if (!glass)
    return (
      <div className="py-20 text-center">
        <p className="tv-handwritten text-3xl">Memory not found</p>
        <button
          onClick={() => navigate("/travel")}
          className="mt-3 text-[var(--tv-accent)] underline"
        >
          Back to all
        </button>
      </div>
    );

  const allPhotos = [
    ...glass.photos,
    ...(glass.glass_url &&
    !glass.photos.some((p) => p.url === glass.glass_url)
      ? [{ id: "glass", url: glass.glass_url, caption: "The shot glass" }]
      : []),
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-6">
      <button
        onClick={() => navigate(-1)}
        className="tv-btn mb-4 inline-flex items-center gap-1 text-[var(--tv-ink-soft)] hover:text-[var(--tv-accent)]"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="tv-handwritten text-5xl leading-none text-[var(--tv-ink)]">
            {glass.location_name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[var(--tv-ink-soft)]">
            {glass.place_detail && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={14} /> {glass.place_detail}
              </span>
            )}
            {glass.collected_at && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={14} /> {formatDateTime(glass.collected_at)}
              </span>
            )}
            {glass.trip && (
              <button
                onClick={() => navigate(`/travel/trip/${glass.trip!.id}`)}
                className="rounded-full bg-[var(--tv-paper-2)] px-3 py-0.5 text-xs font-semibold uppercase tracking-wide hover:bg-[var(--tv-accent)] hover:text-white"
              >
                {glass.trip.name}
              </button>
            )}
          </div>
        </div>
        {unlocked && (
          <button
            onClick={() => setEditing(true)}
            className="tv-btn inline-flex items-center gap-1 bg-[var(--tv-ink)] px-3 py-1.5 text-sm text-[var(--tv-paper)]"
          >
            <Pencil size={14} /> Edit
          </button>
        )}
      </div>

      {/* Album */}
      {allPhotos.length > 0 && (
        <div className="mt-6">
          <Carousel className="mx-auto w-full max-w-2xl">
            <CarouselContent>
              {allPhotos.map((p) => (
                <CarouselItem key={p.id} className="flex justify-center">
                  <div className="tv-polaroid" style={{ rotate: "0deg" }}>
                    <img
                      src={p.url}
                      alt={p.caption ?? glass.location_name}
                      className="max-h-[60vh] w-full rounded object-contain"
                    />
                    {p.caption && (
                      <div className="tv-handwritten py-2 text-center text-xl">
                        {p.caption}
                      </div>
                    )}
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {allPhotos.length > 1 && (
              <>
                <CarouselPrevious className="text-[var(--tv-ink)]" />
                <CarouselNext className="text-[var(--tv-ink)]" />
              </>
            )}
          </Carousel>
        </div>
      )}

      {/* Story */}
      {glass.story && (
        <div className="tv-stitch mx-auto mt-8 max-w-2xl bg-[var(--tv-card)] p-6">
          <p className="whitespace-pre-line text-lg leading-relaxed text-[var(--tv-ink)]">
            {glass.story}
          </p>
        </div>
      )}

      {/* Mini-map */}
      {typeof glass.latitude === "number" && typeof glass.longitude === "number" && (
        <div className="mx-auto mt-8 max-w-2xl">
          <MapView glasses={[glass]} onSelect={() => {}} />
        </div>
      )}

      <GlassEditor
        open={editing}
        onOpenChange={setEditing}
        trips={trips}
        glass={glass}
      />
    </div>
  );
}
