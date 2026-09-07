// A row-ordered grid of polaroid cards. CSS columns would fill vertically,
// which makes chronological data appear out of order when read across a row.

import PolaroidCard from "./PolaroidCard";
import type { GlassWithDetails } from "../lib/types";

interface Props {
  glasses: GlassWithDetails[];
  onSelect: (g: GlassWithDetails) => void;
}

export default function GalleryView({ glasses, onSelect }: Props) {
  if (glasses.length === 0) return <EmptyState />;

  return (
    <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {glasses.map((g, i) => (
        <div key={g.id}>
          <PolaroidCard glass={g} index={i} onClick={() => onSelect(g)} />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="tv-stitch mx-auto mt-10 max-w-md p-10 text-center">
      <div className="text-5xl">🥃</div>
      <p className="tv-handwritten mt-3 text-3xl text-[var(--tv-ink)]">
        No shot glasses yet
      </p>
      <p className="mt-1 text-sm text-[var(--tv-ink-soft)]">
        Unlock editing and add your first memory.
      </p>
    </div>
  );
}
