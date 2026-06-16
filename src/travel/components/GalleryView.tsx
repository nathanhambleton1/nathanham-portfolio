// Masonry-ish gallery of polaroid cards.

import PolaroidCard from "./PolaroidCard";
import type { GlassWithDetails } from "../lib/types";

interface Props {
  glasses: GlassWithDetails[];
  onSelect: (g: GlassWithDetails) => void;
}

export default function GalleryView({ glasses, onSelect }: Props) {
  if (glasses.length === 0) return <EmptyState />;

  return (
    <div className="[column-fill:_balance] columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4">
      {glasses.map((g, i) => (
        <div key={g.id} className="mb-7 break-inside-avoid">
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
