// Add / edit a glass (location). Includes a single "shot glass" photo,
// a click-to-place map picker, and (when editing) the photo album.

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
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
import { uploadImage } from "../lib/api";
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

// ISO <-> <input type="datetime-local"> helpers.
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function MapPicker({
  lat,
  lng,
  onPick,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
}) {
  function ClickCatcher() {
    useMapEvents({
      click(e) {
        onPick(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  }
  const hasPoint = typeof lat === "number" && typeof lng === "number";
  return (
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
      {hasPoint && (
        <Marker position={[lat as number, lng as number]} icon={pinIcon} />
      )}
    </MapContainer>
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
      collected_at: isoToLocalInput(glass?.collected_at ?? null),
      trip_id: glass?.trip_id ?? defaultTripId ?? NO_TRIP,
      story: glass?.story ?? "",
    });
    setLat(glass?.latitude ?? null);
    setLng(glass?.longitude ?? null);
    setGlassUrl(glass?.glass_url ?? null);
  }, [open, glass, defaultTripId, reset]);

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
        await createGlass.mutateAsync(payload);
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-sm font-semibold">Place</Label>
              <Input
                {...register("place_detail")}
                placeholder="Rome, Italy"
                className="bg-white"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold">Date &amp; time</Label>
              <Input
                type="datetime-local"
                {...register("collected_at")}
                className="bg-white"
              />
            </div>
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

          {/* Map picker */}
          <div>
            <Label className="text-sm font-semibold">
              Location on map{" "}
              <span className="font-normal text-[var(--tv-ink-soft)]">
                (tap to place a pin)
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

          {/* Album (only for existing glass) */}
          {isEdit && glass && (
            <div>
              <Label className="text-sm font-semibold">Photo album</Label>
              <div className="mt-1">
                <PhotoUploader glassId={glass.id} photos={glass.photos} />
              </div>
            </div>
          )}

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
