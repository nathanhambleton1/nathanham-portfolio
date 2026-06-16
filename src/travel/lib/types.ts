// Shared types for the Travel / Shot Glass Journey section.

export interface Trip {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null; // ISO date
  end_date: string | null;   // ISO date
  cover_url: string | null;
  color: string | null;      // accent hex
  sort_order: number;
  created_at: string;
}

export interface Photo {
  id: string;
  glass_id: string;
  url: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export interface Glass {
  id: string;
  trip_id: string | null;
  location_name: string;
  place_detail: string | null;
  latitude: number | null;
  longitude: number | null;
  collected_at: string | null; // ISO datetime
  story: string | null;
  glass_url: string | null;
  sort_order: number;
  created_at: string;
}

// A glass with its joined photos + trip, used throughout the UI.
export interface GlassWithDetails extends Glass {
  photos: Photo[];
  trip: Trip | null;
}

// Input payloads (no server-managed fields).
export type TripInput = Omit<Trip, "id" | "created_at" | "sort_order"> &
  Partial<Pick<Trip, "sort_order">>;

export type GlassInput = Omit<Glass, "id" | "created_at" | "sort_order"> &
  Partial<Pick<Glass, "sort_order">>;
