// Add / edit / delete a trip.

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { uploadImage } from "../lib/api";
import { useCreateTrip, useDeleteTrip, useUpdateTrip } from "../lib/queries";
import type { Trip } from "../lib/types";

const schema = z.object({
  name: z.string().min(1, "Name your trip"),
  description: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  color: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip?: Trip;
}

export default function TripEditor({ open, onOpenChange, trip }: Props) {
  const isEdit = Boolean(trip);
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const deleteTrip = useDeleteTrip();

  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    reset({
      name: trip?.name ?? "",
      description: trip?.description ?? "",
      start_date: trip?.start_date ?? "",
      end_date: trip?.end_date ?? "",
      color: trip?.color ?? "#d9794f",
    });
    setCoverUrl(trip?.cover_url ?? null);
  }, [open, trip, reset]);

  const onCover = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, "trips/_covers");
      setCoverUrl(url);
    } catch (err) {
      console.error(err);
      toast.error("Upload failed. Check the storage bucket setup.");
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    const payload = {
      name: values.name.trim(),
      description: values.description?.trim() || null,
      start_date: values.start_date || null,
      end_date: values.end_date || null,
      color: values.color || null,
      cover_url: coverUrl,
    };
    try {
      if (isEdit && trip) {
        await updateTrip.mutateAsync({ id: trip.id, patch: payload });
        toast.success("Trip updated 🧳");
      } else {
        await createTrip.mutateAsync(payload);
        toast.success("Trip created 🧳");
      }
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Could not save the trip.");
    }
  };

  const onDelete = async () => {
    if (!trip) return;
    if (
      !window.confirm(
        `Delete "${trip.name}"? Glasses stay, but lose their trip tag.`
      )
    )
      return;
    try {
      await deleteTrip.mutateAsync(trip.id);
      toast.success("Trip deleted.");
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Could not delete the trip.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="travel-root max-h-[90vh] overflow-y-auto border-none bg-[var(--tv-card)] text-[var(--tv-ink)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="tv-handwritten text-3xl">
            {isEdit ? "Edit trip" : "New trip"} 🧳
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div>
            <Label className="text-sm font-semibold">Trip name</Label>
            <Input
              {...register("name")}
              placeholder="Europe 2025"
              className="bg-white"
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label className="text-sm font-semibold">Description</Label>
            <Textarea
              {...register("description")}
              rows={2}
              placeholder="Three weeks, six countries…"
              className="bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-semibold">Start</Label>
              <Input type="date" {...register("start_date")} className="bg-white" />
            </div>
            <div>
              <Label className="text-sm font-semibold">End</Label>
              <Input type="date" {...register("end_date")} className="bg-white" />
            </div>
          </div>

          <div className="flex items-end gap-4">
            <div>
              <Label className="text-sm font-semibold">Accent color</Label>
              <Input
                type="color"
                {...register("color")}
                className="h-10 w-16 cursor-pointer bg-white p-1"
              />
            </div>
            <div className="flex-1">
              <Label className="text-sm font-semibold">Cover photo</Label>
              <div className="mt-1 flex items-center gap-2">
                {coverUrl ? (
                  <div className="relative">
                    <img
                      src={coverUrl}
                      alt="cover"
                      className="h-14 w-20 rounded object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setCoverUrl(null)}
                      className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ) : (
                  <label className="grid h-14 w-20 cursor-pointer place-items-center rounded border-2 border-dashed border-[rgba(58,47,40,0.3)] text-[var(--tv-ink-soft)] hover:border-[var(--tv-accent)]">
                    {uploading ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <ImagePlus size={18} />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => onCover(e.target.files?.[0])}
                    />
                  </label>
                )}
              </div>
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
              {isEdit ? "Save changes" : "Create trip"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
