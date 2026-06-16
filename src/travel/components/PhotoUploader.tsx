// Manage the photo album for an existing glass: upload (multi), preview, delete.

import { useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "../lib/api";
import { useAddPhoto, useDeletePhoto } from "../lib/queries";
import type { Photo } from "../lib/types";

interface Props {
  glassId: string;
  photos: Photo[];
}

export default function PhotoUploader({ glassId, photos }: Props) {
  const [busy, setBusy] = useState(false);
  const addPhoto = useAddPhoto();
  const deletePhoto = useDeletePhoto();

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      let order = photos.length;
      for (const file of Array.from(files)) {
        const url = await uploadImage(file, `glasses/${glassId}`);
        await addPhoto.mutateAsync({
          glassId,
          url,
          caption: null,
          sortOrder: order++,
        });
      }
      toast.success("Photos added 📸");
    } catch (err) {
      console.error(err);
      toast.error("Upload failed. Check the storage bucket setup.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {photos.map((p) => (
          <div key={p.id} className="group relative">
            <img
              src={p.url}
              alt={p.caption ?? ""}
              className="h-20 w-20 rounded-md object-cover"
            />
            <button
              type="button"
              onClick={() => deletePhoto.mutate(p.id)}
              className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
              title="Delete photo"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}

        <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-md border-2 border-dashed border-[rgba(58,47,40,0.3)] text-[var(--tv-ink-soft)] hover:border-[var(--tv-accent)] hover:text-[var(--tv-accent)]">
          {busy ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <ImagePlus size={20} />
          )}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={busy}
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
      </div>
      <p className="text-xs text-[var(--tv-ink-soft)]">
        Add one or more photos from this place.
      </p>
    </div>
  );
}
