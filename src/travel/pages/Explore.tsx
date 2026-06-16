// Main travel page: header, view switcher, filters, and the add FAB.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Images, Map as MapIcon, Clock, Luggage } from "lucide-react";
import { useGlasses, useTrips } from "../lib/queries";
import { useEditMode } from "../context/EditMode";
import { countryFromPlace, getYear } from "../lib/format";
import PasswordGate from "../components/PasswordGate";
import FilterBar, { DEFAULT_FILTERS, FilterState } from "../components/FilterBar";
import GalleryView from "../components/GalleryView";
import MapView from "../components/MapView";
import TimelineView from "../components/TimelineView";
import TripsView from "../components/TripsView";
import GlassEditor from "../components/GlassEditor";
import TripEditor from "../components/TripEditor";
import type { GlassWithDetails, Trip } from "../lib/types";

type ViewKey = "gallery" | "map" | "timeline" | "trips";

const VIEWS: { key: ViewKey; label: string; icon: typeof Images }[] = [
  { key: "gallery", label: "Gallery", icon: Images },
  { key: "map", label: "Map", icon: MapIcon },
  { key: "timeline", label: "Timeline", icon: Clock },
  { key: "trips", label: "Trips", icon: Luggage },
];

export default function Explore() {
  const navigate = useNavigate();
  const { data: glasses = [], isLoading } = useGlasses();
  const { data: trips = [] } = useTrips();
  const { unlocked } = useEditMode();

  const [view, setView] = useState<ViewKey>("gallery");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [addingGlass, setAddingGlass] = useState(false);
  const [addingTrip, setAddingTrip] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | undefined>(undefined);
  const [fabOpen, setFabOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

  // Close FAB menu when clicking outside.
  useEffect(() => {
    if (!fabOpen) return;
    const handler = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setFabOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [fabOpen]);

  // Filter option lists.
  const countries = useMemo(() => {
    const set = new Set<string>();
    glasses.forEach((g) => {
      const c = countryFromPlace(g.place_detail);
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [glasses]);

  const years = useMemo(() => {
    const set = new Set<string>();
    glasses.forEach((g) => {
      const y = getYear(g.collected_at);
      if (y) set.add(y);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [glasses]);

  // Apply filters + sort.
  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    let out = glasses.filter((g) => {
      if (filters.tripId && g.trip_id !== filters.tripId) return false;
      if (filters.country && countryFromPlace(g.place_detail) !== filters.country)
        return false;
      if (filters.year && getYear(g.collected_at) !== filters.year) return false;
      if (q) {
        const hay = `${g.location_name} ${g.place_detail ?? ""} ${
          g.story ?? ""
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      if (filters.sort === "name")
        return a.location_name.localeCompare(b.location_name);
      const ta = a.collected_at ? Date.parse(a.collected_at) : 0;
      const tb = b.collected_at ? Date.parse(b.collected_at) : 0;
      return filters.sort === "date-asc" ? ta - tb : tb - ta;
    });
    return out;
  }, [glasses, filters]);

  const openGlass = (g: GlassWithDetails) => navigate(`/travel/glass/${g.id}`);
  const openTrip = (t: Trip) => navigate(`/travel/trip/${t.id}`);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-8">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="tv-handwritten text-6xl leading-none text-[var(--tv-ink)]">
            Our Travels
          </h1>
          <p className="mt-1 text-sm text-[var(--tv-ink-soft)]">
            A shot glass from every place we've been — {glasses.length} memories
            {trips.length > 0 && ` · ${trips.length} trips`}
          </p>
        </div>
        <PasswordGate />
      </header>

      {/* View switcher */}
      <div className="mb-5 flex flex-wrap gap-2">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              data-active={view === v.key}
              className="tv-chip inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm"
            >
              <Icon size={15} /> {v.label}
            </button>
          );
        })}
      </div>

      {/* Filters (not for trips view) */}
      {view !== "trips" && (
        <div className="mb-6">
          <FilterBar
            state={filters}
            onChange={setFilters}
            trips={trips.map((t) => ({ id: t.id, name: t.name }))}
            countries={countries}
            years={years}
          />
        </div>
      )}

      {/* Active view */}
      {isLoading ? (
        <p className="py-20 text-center text-[var(--tv-ink-soft)]">
          Loading memories…
        </p>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {view === "gallery" && (
              <GalleryView glasses={filtered} onSelect={openGlass} />
            )}
            {view === "map" && <MapView glasses={filtered} onSelect={openGlass} />}
            {view === "timeline" && (
              <TimelineView glasses={filtered} onSelect={openGlass} />
            )}
            {view === "trips" && (
              <TripsView
                trips={trips}
                glasses={glasses}
                onOpenTrip={openTrip}
                canEdit={unlocked}
                onEditTrip={(t) => setEditingTrip(t)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Add FAB (only when unlocked) */}
      {unlocked && (
        <div ref={fabRef} className="tv-fab" style={{ position: "fixed", right: 20, bottom: 20, zIndex: 50 }}>
          <AnimatePresence>
            {fabOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-16 right-0 flex min-w-[160px] flex-col overflow-hidden rounded-2xl shadow-xl"
                style={{ background: "var(--tv-card)", border: "1.5px solid rgba(58,47,40,0.14)" }}
              >
                <button
                  type="button"
                  onClick={() => { setAddingGlass(true); setFabOpen(false); }}
                  className="flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-[var(--tv-ink)] transition hover:bg-[var(--tv-paper-2)]"
                >
                  <span className="text-lg">🥃</span> New memory
                </button>
                <div style={{ height: 1, background: "rgba(58,47,40,0.1)" }} />
                <button
                  type="button"
                  onClick={() => { setAddingTrip(true); setFabOpen(false); }}
                  className="flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-[var(--tv-ink)] transition hover:bg-[var(--tv-paper-2)]"
                >
                  <span className="text-lg">🧳</span> New trip
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => setFabOpen((o) => !o)}
            className="tv-btn grid h-14 w-14 place-items-center rounded-full bg-[var(--tv-accent)] text-white shadow-lg"
            title="Add"
            style={{ boxShadow: "0 -4px 20px rgba(217,121,79,0.4), 0 2px 10px rgba(217,121,79,0.25)" }}
          >
            <motion.span animate={{ rotate: fabOpen ? 45 : 0 }} transition={{ duration: 0.2 }}>
              <Plus size={26} />
            </motion.span>
          </button>
        </div>
      )}

      <GlassEditor open={addingGlass} onOpenChange={setAddingGlass} trips={trips} />
      <TripEditor open={addingTrip} onOpenChange={setAddingTrip} />
      <TripEditor
        open={Boolean(editingTrip)}
        onOpenChange={(o) => !o && setEditingTrip(undefined)}
        trip={editingTrip}
      />
    </div>
  );
}
