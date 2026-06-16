// Add / edit a glass (location). Includes a single "shot glass" photo,
// a click-to-place map picker, and (when editing) the photo album.

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ImagePlus, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addPhoto, uploadImage } from "../lib/api";
import {
  useCreateGlass,
  useDeleteGlass,
  useUpdateGlass,
} from "../lib/queries";
import PhotoUploader from "./PhotoUploader";
import type { GlassWithDetails, Trip } from "../lib/types";

const schema = z.object({
  location_name: z.string().min(1, "Give this place a name"),
  place_detail: z.string().optional(),
  collected_at: z.string().optional(),
  trip_id: z.string().optional(),
  story: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const NO_TRIP = "__none__";

const pinIcon = L.divIcon({
  className: "tv-pin-wrap",
  html: '<div class="tv-pin"><span>🥃</span></div>',
  iconSize: [38, 38],
  iconAnchor: [19, 38],
});

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
};

// Turn Nominatim's verbose label ("Roma, Roma Capitale, Lazio, Italia") into a
// tidy "City, Country" string for the Place field — still editable afterwards.
function shortPlace(r: NominatimResult): string {
  const a = r.address;
  if (a) {
    const locality =
      a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality ?? a.county ?? a.state;
    const out = [locality, a.country].filter(Boolean).join(", ");
    if (out) return out;
  }
  // Fallback: first + last segment of the display name ("Rome, Italy").
  const parts = r.display_name.split(",").map((s) => s.trim());
  return parts.length <= 2 ? r.display_name : `${parts[0]}, ${parts[parts.length - 1]}`;
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  const prev = useRef<[number, number] | null>(null);
  useEffect(() => {
    if (!target) return;
    if (prev.current?.[0] === target[0] && prev.current?.[1] === target[1]) return;
    prev.current = target;
    map.flyTo(target, 12, { duration: 1.2 });
  }, [target, map]);
  return null;
}

function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function MapPicker({
  lat,
  lng,
  onPick,
  onPlace,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
  onPlace?: (place: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 3) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`
        );
        setResults(await res.json());
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!results.length) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setResults([]);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [results.length]);

  const pickResult = (r: NominatimResult) => {
    const la = parseFloat(r.lat);
    const ln = parseFloat(r.lon);
    onPick(la, ln);
    onPlace?.(shortPlace(r));
    setFlyTarget([la, ln]);
    setQuery("");
    setResults([]);
  };

  function ClickCatcher() {
    useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
    return null;
  }

  const hasPoint = typeof lat === "number" && typeof lng === "number";
  return (
    <div>
      {/* Geocoder search */}
      <div ref={dropdownRef} className="relative mb-2">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tv-ink-soft)]"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a place…"
            className="w-full rounded-md border border-[rgba(58,47,40,0.2)] bg-white py-1.5 pl-8 pr-8 text-sm text-[var(--tv-ink)] placeholder:text-[var(--tv-ink-soft)] focus:outline-none focus:ring-1 focus:ring-[var(--tv-accent)]"
          />
          {searching && (
            <Loader2
              size={13}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-[var(--tv-ink-soft)]"
            />
          )}
        </div>
        {results.length > 0 && (
          <ul className="absolute z-[2000] mt-0.5 w-full overflow-hidden rounded-lg border border-[rgba(58,47,40,0.14)] bg-white shadow-lg">
            {results.map((r, i) => (
              <li key={i} className="border-b border-[rgba(58,47,40,0.07)] last:border-0">
                <button
                  type="button"
                  onClick={() => pickResult(r)}
                  className="w-full px-3 py-2 text-left text-sm leading-tight text-[var(--tv-ink)] hover:bg-[var(--tv-paper-2)]"
                >
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <MapContainer
        center={hasPoint ? [lat as number, lng as number] : [30, 10]}
        zoom={hasPoint ? 6 : 2}
        style={{ height: 180, width: "100%", borderRadius: 12 }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickCatcher />
        <FlyTo target={flyTarget} />
        {hasPoint && (
          <Marker position={[lat as number, lng as number]} icon={pinIcon} />
        )}
      </MapContainer>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trips: Trip[];
  // Provided when editing; undefined when adding.
  glass?: GlassWithDetails;
  // Pre-select a trip when adding from a trip page.
  defaultTripId?: string | null;
}

export default function GlassEditor({
  open,
  onOpenChange,
  trips,
  glass,
  defaultTripId,
}: Props) {
  const isEdit = Boolean(glass);
  const createGlass = useCreateGlass();
  const updateGlass = useUpdateGlass();
  const deleteGlass = useDeleteGlass();

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [glassUrl, setGlassUrl] = useState<string | null>(null);
  const [uploadingGlass, setUploadingGlass] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<{ file: File; preview: string }[]>([]);
  const pendingDragIdx = useRef<number | null>(null);
  const [pendingDragOver, setPendingDragOver] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Sync form + local state whenever the dialog opens or target changes.
  useEffect(() => {
    if (!open) return;
    reset({
      location_name: glass?.location_name ?? "",
      place_detail: glass?.place_detail ?? "",
      collected_at: isoToDateInput(glass?.collected_at ?? null),
      trip_id: glass?.trip_id ?? defaultTripId ?? NO_TRIP,
      story: glass?.story ?? "",
    });
    setLat(glass?.latitude ?? null);
    setLng(glass?.longitude ?? null);
    setGlassUrl(glass?.glass_url ?? null);
  }, [open, glass, defaultTripId, reset]);

  // Revoke staged photo object URLs when the dialog closes.
  useEffect(() => {
    if (open) return;
    setPendingPhotos((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.preview));
      return [];
    });
  }, [open]);

  const tripId = watch("trip_id");

  const onGlassPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploadingGlass(true);
    try {
      const url = await uploadImage(file, "glasses/_covers");
      setGlassUrl(url);
    } catch (err) {
      console.error(err);
      toast.error("Upload failed. Check the storage bucket setup.");
    } finally {
      setUploadingGlass(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    const payload = {
      location_name: values.location_name.trim(),
      place_detail: values.place_detail?.trim() || null,
      collected_at: values.collected_at
        ? new Date(values.collected_at).toISOString()
        : null,
      trip_id: values.trip_id && values.trip_id !== NO_TRIP ? values.trip_id : null,
      story: values.story?.trim() || null,
      glass_url: glassUrl,
      latitude: lat,
      longitude: lng,
    };
    try {
      if (isEdit && glass) {
        await updateGlass.mutateAsync({ id: glass.id, patch: payload });
        toast.success("Memory updated 💖");
      } else {
        const newGlass = await createGlass.mutateAsync(payload);
        if (pendingPhotos.length > 0) {
          for (let i = 0; i < pendingPhotos.length; i++) {
            const url = await uploadImage(pendingPhotos[i].file, `glasses/${newGlass.id}`);
            await addPhoto(newGlass.id, url, null, i);
          }
        }
        toast.success("Memory saved 💖");
      }
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Could not save. Is the database set up?");
    }
  };

  const onDelete = async () => {
    if (!glass) return;
    if (!window.confirm(`Delete "${glass.location_name}" and its photos?`)) return;
    try {
      await deleteGlass.mutateAsync(glass.id);
      toast.success("Deleted.");
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Could not delete.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="travel-root max-h-[90vh] overflow-y-auto border-none bg-[var(--tv-card)] text-[var(--tv-ink)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="tv-handwritten text-3xl">
            {isEdit ? "Edit memory" : "New memory"} 🥃
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div>
            <Label className="text-sm font-semibold">Location name</Label>
            <Input
              {...register("location_name")}
              placeholder="Trevi Fountain"
              className="bg-white"
            />
            {errors.location_name && (
              <p className="text-xs text-red-500">{errors.location_name.message}</p>
            )}
          </div>

          <div>
            <Label className="text-sm font-semibold">Date</Label>
            <Input
              type="date"
              {...register("collected_at")}
              className="bg-white"
            />
          </div>

          <div>
            <Label className="text-sm font-semibold">Trip</Label>
            <Select
              value={tripId ?? NO_TRIP}
              onValueChange={(v) => setValue("trip_id", v)}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="No trip" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TRIP}>No trip</SelectItem>
                {trips.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-semibold">The story</Label>
            <Textarea
              {...register("story")}
              placeholder="What made this place special…"
              rows={3}
              className="bg-white"
            />
          </div>

          {/* Map picker */}
          <div>
            <Label className="text-sm font-semibold">
              Location on map{" "}
              <span className="font-normal text-[var(--tv-ink-soft)]">
                (search or tap to place a pin)
              </span>
            </Label>
            <div className="mt-1">
              <MapPicker
                lat={lat}
                lng={lng}
                onPick={(la, ln) => {
                  setLat(la);
                  setLng(ln);
                }}
                onPlace={(p) =>
                  setValue("place_detail", p, { shouldDirty: true })
                }
              />
            </div>
            {lat !== null && lng !== null && (
              <button
                type="button"
                onClick={() => {
                  setLat(null);
                  setLng(null);
                }}
                className="mt-1 text-xs text-[var(--tv-ink-soft)] underline"
              >
                Clear pin ({lat.toFixed(3)}, {lng.toFixed(3)})
              </button>
            )}
          </div>

          {/* Place — autofilled from the map, but editable. */}
          <div>
            <Label className="text-sm font-semibold">Place</Label>
            <Input
              {...register("place_detail")}
              placeholder="Rome, Italy"
              className="bg-white"
            />
          </div>

          {/* Shot glass photo */}
          <div>
            <Label className="text-sm font-semibold">Shot glass photo</Label>
            <div className="mt-1 flex items-center gap-3">
              {glassUrl ? (
                <div className="relative">
                  <img
                    src={glassUrl}
                    alt="shot glass"
                    className="h-20 w-20 rounded-md object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setGlassUrl(null)}
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ) : (
                <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-md border-2 border-dashed border-[rgba(58,47,40,0.3)] text-[var(--tv-ink-soft)] hover:border-[var(--tv-accent)]">
                  {uploadingGlass ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <ImagePlus size={20} />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingGlass}
                    onChange={(e) => onGlassPhoto(e.target.files?.[0])}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Photo album */}
          <div>
            <Label className="text-sm font-semibold">Photo album</Label>
            <div className="mt-1">
              {isEdit && glass ? (
                <PhotoUploader glassId={glass.id} photos={glass.photos} />
              ) : (
                <div>
                  <div className="flex flex-wrap gap-2">
                    {pendingPhotos.map((p, i) => (
                      <div
                        key={i}
                        draggable
                        onDragStart={() => { pendingDragIdx.current = i; }}
                        onDragOver={(e) => { e.preventDefault(); setPendingDragOver(i); }}
                        onDragLeave={() => setPendingDragOver(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          const from = pendingDragIdx.current;
                          if (from === null || from === i) { setPendingDragOver(null); return; }
                          setPendingPhotos((prev) => {
                            const next = [...prev];
                            const [moved] = next.splice(from, 1);
                            next.splice(i, 0, moved);
                            return next;
                          });
                          pendingDragIdx.current = null;
                          setPendingDragOver(null);
                        }}
                        onDragEnd={() => { pendingDragIdx.current = null; setPendingDragOver(null); }}
                        className={`group relative cursor-grab active:cursor-grabbing rounded-md transition-all ${
                          pendingDragOver === i ? "ring-2 ring-[var(--tv-accent)] scale-105" : ""
                        }`}
                      >
                        <img
                          src={p.preview}
                          alt=""
                          className="h-20 w-20 rounded-md object-cover pointer-events-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPendingPhotos((prev) => {
                              URL.revokeObjectURL(prev[i].preview);
                              return prev.filter((_, j) => j !== i);
                            })
                          }
                          className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-md border-2 border-dashed border-[rgba(58,47,40,0.3)] text-[var(--tv-ink-soft)] hover:border-[var(--tv-accent)] hover:text-[var(--tv-accent)]">
                      <ImagePlus size={20} />
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          setPendingPhotos((prev) => [
                            ...prev,
                            ...files.map((f) => ({ file: f, preview: URL.createObjectURL(f) })),
                          ]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-[var(--tv-ink-soft)]">
                    Drag photos to reorder · Add one or more from this place.
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-2 gap-2 sm:justify-between">
            {isEdit ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onDelete}
                className="text-red-500 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={15} className="mr-1" /> Delete
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="tv-btn bg-[var(--tv-accent)] text-white hover:bg-[var(--tv-accent)]/90"
            >
              {isSubmitting && <Loader2 className="mr-1 animate-spin" size={15} />}
              {isEdit ? "Save changes" : "Save memory"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
