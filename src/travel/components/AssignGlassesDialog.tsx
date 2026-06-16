// Pick existing glasses from the full gallery and assign them to a trip.

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUpdateGlass } from "../lib/queries";
import type { GlassWithDetails } from "../lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  tripName: string;
  allGlasses: GlassWithDetails[];
}

export default function AssignGlassesDialog({
  open,
  onOpenChange,
  tripId,
  tripName,
  allGlasses,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const updateGlass = useUpdateGlass();

  const candidates = allGlasses.filter((g) => g.trip_id !== tripId);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleClose = (o: boolean) => {
    if (!saving) {
      setSelected(new Set());
      onOpenChange(o);
    }
  };

  const handleAdd = async () => {
    if (!selected.size) return;
    setSaving(true);
    try {
      await Promise.all(
        [...selected].map((id) =>
          updateGlass.mutateAsync({ id, patch: { trip_id: tripId } })
        )
      );
      toast.success(
        `Added ${selected.size} glass${selected.size === 1 ? "" : "es"} to ${tripName} 🧳`
      );
      setSelected(new Set());
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Could not assign glasses.");
    } finally {
      setSaving(false);
    }
  };

  const thumb = (g: GlassWithDetails) => g.photos[0]?.url ?? g.glass_url ?? null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="travel-root border-none bg-[var(--tv-card)] text-[var(--tv-ink)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="tv-handwritten text-3xl">
            Add to {tripName} 🧳
          </DialogTitle>
        </DialogHeader>

        {candidates.length === 0 ? (
          <p className="py-8 text-center text-[var(--tv-ink-soft)]">
            All your memories are already in this trip.
          </p>
        ) : (
          <>
            <p className="text-sm text-[var(--tv-ink-soft)]">
              Select memories from your gallery to add to this trip.
            </p>

            <div className="mt-3 grid max-h-[52vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
              {candidates.map((g) => {
                const isSelected = selected.has(g.id);
                const img = thumb(g);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggle(g.id)}
                    className={`relative rounded-xl border-2 p-2 text-left transition ${
                      isSelected
                        ? "border-[var(--tv-accent)] bg-[var(--tv-paper-2)]"
                        : "border-[rgba(58,47,40,0.14)] bg-white hover:border-[rgba(58,47,40,0.3)]"
                    }`}
                  >
                    {img ? (
                      <img
                        src={img}
                        alt={g.location_name}
                        className="mb-2 h-24 w-full rounded-lg object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="mb-2 grid h-24 w-full place-items-center rounded-lg bg-[var(--tv-paper-2)] text-3xl">
                        🥃
                      </div>
                    )}
                    <div className="truncate text-sm font-semibold leading-tight">
                      {g.location_name}
                    </div>
                    {g.place_detail && (
                      <div className="truncate text-xs text-[var(--tv-ink-soft)]">
                        {g.place_detail}
                      </div>
                    )}
                    {g.trip && (
                      <div className="mt-0.5 truncate text-xs text-[var(--tv-accent)]">
                        Currently in {g.trip.name}
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[var(--tv-accent)] text-white shadow">
                        <Check size={13} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-[var(--tv-ink-soft)]">
                {selected.size > 0
                  ? `${selected.size} selected`
                  : "Tap a memory to select it"}
              </span>
              <Button
                onClick={handleAdd}
                disabled={selected.size === 0 || saving}
                className="tv-btn bg-[var(--tv-accent)] text-white hover:bg-[var(--tv-accent)]/90 disabled:opacity-40"
              >
                {saving && <Loader2 className="mr-1 animate-spin" size={15} />}
                Add{selected.size > 0 ? ` ${selected.size}` : ""}{" "}
                {selected.size === 1 ? "glass" : "glasses"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
