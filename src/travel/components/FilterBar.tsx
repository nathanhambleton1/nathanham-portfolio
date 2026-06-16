// Search + sort + filter controls for the gallery.

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SortKey = "date-desc" | "date-asc" | "name";

export interface FilterState {
  search: string;
  sort: SortKey;
  tripId: string | null;
  country: string | null;
  year: string | null;
}

export const DEFAULT_FILTERS: FilterState = {
  search: "",
  sort: "date-desc",
  tripId: null,
  country: null,
  year: null,
};

const ALL = "__all__";

interface Props {
  state: FilterState;
  onChange: (next: FilterState) => void;
  trips: { id: string; name: string }[];
  countries: string[];
  years: string[];
}

export default function FilterBar({
  state,
  onChange,
  trips,
  countries,
  years,
}: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...state, ...patch });
  const hasFilters =
    state.search || state.tripId || state.country || state.year;

  const selectClass =
    "h-9 w-[140px] rounded-full border-2 border-[rgba(58,47,40,0.18)] bg-transparent text-[var(--tv-ink)]";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[180px] flex-1">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tv-ink-soft)]"
        />
        <Input
          value={state.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search places & memories…"
          className="h-9 rounded-full border-2 border-[rgba(58,47,40,0.18)] bg-transparent pl-9 text-[var(--tv-ink)] placeholder:text-[var(--tv-ink-soft)]"
        />
      </div>

      <Select value={state.sort} onValueChange={(v) => set({ sort: v as SortKey })}>
        <SelectTrigger className={selectClass}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="date-desc">Newest first</SelectItem>
          <SelectItem value="date-asc">Oldest first</SelectItem>
          <SelectItem value="name">By place name</SelectItem>
        </SelectContent>
      </Select>

      {trips.length > 0 && (
        <Select
          value={state.tripId ?? ALL}
          onValueChange={(v) => set({ tripId: v === ALL ? null : v })}
        >
          <SelectTrigger className={selectClass}>
            <SelectValue placeholder="Trip" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All trips</SelectItem>
            {trips.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {countries.length > 0 && (
        <Select
          value={state.country ?? ALL}
          onValueChange={(v) => set({ country: v === ALL ? null : v })}
        >
          <SelectTrigger className={selectClass}>
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All countries</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {years.length > 0 && (
        <Select
          value={state.year ?? ALL}
          onValueChange={(v) => set({ year: v === ALL ? null : v })}
        >
          <SelectTrigger className="h-9 w-[100px] rounded-full border-2 border-[rgba(58,47,40,0.18)] bg-transparent text-[var(--tv-ink)]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasFilters && (
        <button
          type="button"
          onClick={() =>
            onChange({ ...DEFAULT_FILTERS, sort: state.sort })
          }
          className="tv-btn inline-flex items-center gap-1 px-3 py-1.5 text-sm text-[var(--tv-ink-soft)] hover:text-[var(--tv-accent)]"
        >
          <X size={14} /> Clear
        </button>
      )}
    </div>
  );
}
