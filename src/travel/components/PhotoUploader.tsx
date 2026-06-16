// Manage the photo album for an existing glass: upload (multi), delete, drag-to-reorder.

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "../lib/api";
import { useAddPhoto, useDeletePhoto, useReorderPhotos } from "../lib/queries";
import type { Photo } from "../lib/types";

interface Props {
  glassId: string;
  photos: Photo[];
}

export default function PhotoUploader({ glassId, photos }: Props) {
  const [busy, setBusy] = useState(false);
  const [localPhotos, setLocalPhotos] = useState<Photo[]>(photos);
  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const addPhoto = useAddPhoto();
  const deletePhoto = useDeletePhoto();
  const reorderPhotos = useReorderPhotos();

  // Sync local list when the query updates (uploads, deletes).
  useEffect(() => {
    setLocalPhotos(photos);
  }, [photos]);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      let order = localPhotos.length;
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

  const onDrop = (toIdx: number) => {
    const fromIdx = dragIdx.current;
    if (fromIdx === null || fromIdx === toIdx) return;
    const reordered = [...localPhotos];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setLocalPhotos(reordered);
    setDragOver(null);
    dragIdx.current = null;
    reorderPhotos.mutate(
      reordered.map((p, i) => ({ id: p.id, sortOrder: i }))
    );
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {localPhotos.map((p, i) => (
          <div
            key={p.id}
            draggable
            onDragStart={() => { dragIdx.current = i; }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(i); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => { e.preventDefault(); onDrop(i); }}
            onDragEnd={() => { dragIdx.current = null; setDragOver(null); }}
            className={`group relative cursor-grab active:cursor-grabbing rounded-md transition-all ${
              dragOver === i ? "ring-2 ring-[var(--tv-accent)] scale-105" : ""
            }`}
          >
            <img
              src={p.url}
              alt={p.caption ?? ""}
              className="h-20 w-20 rounded-md object-cover pointer-events-none"
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
        Drag photos to reorder · Add one or more from this place.
      </p>
    </div>
  );
}
