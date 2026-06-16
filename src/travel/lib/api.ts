// Supabase data access for the Travel section.
// Reuses the shared client from src/lib/supabase.ts.

import { supabase } from "@/lib/supabase";
import type {
  Glass,
  GlassInput,
  GlassWithDetails,
  Photo,
  Trip,
  TripInput,
} from "./types";

const BUCKET = "travel-photos";

/* --------------------------------- Trips --------------------------------- */

export async function fetchTrips(): Promise<Trip[]> {
  const { data, error } = await supabase
    .from("travel_trips")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("start_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Trip[];
}

export async function createTrip(input: TripInput): Promise<Trip> {
  const { data, error } = await supabase
    .from("travel_trips")
    .insert([input])
    .select()
    .single();
  if (error) throw error;
  return data as Trip;
}

export async function updateTrip(
  id: string,
  patch: Partial<TripInput>
): Promise<Trip> {
  const { data, error } = await supabase
    .from("travel_trips")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Trip;
}

export async function deleteTrip(id: string): Promise<void> {
  const { error } = await supabase.from("travel_trips").delete().eq("id", id);
  if (error) throw error;
}

/* -------------------------------- Glasses -------------------------------- */

export async function fetchGlasses(): Promise<GlassWithDetails[]> {
  const { data, error } = await supabase
    .from("travel_glasses")
    .select("*, photos:travel_photos(*), trip:travel_trips(*)")
    .order("collected_at", { ascending: false });
  if (error) throw error;

  const glasses = (data ?? []) as (Glass & {
    photos: Photo[] | null;
    trip: Trip | null;
  })[];

  return glasses.map((g) => ({
    ...g,
    photos: (g.photos ?? []).sort((a, b) => a.sort_order - b.sort_order),
    trip: g.trip ?? null,
  }));
}

export async function createGlass(input: GlassInput): Promise<Glass> {
  const { data, error } = await supabase
    .from("travel_glasses")
    .insert([input])
    .select()
    .single();
  if (error) throw error;
  return data as Glass;
}

export async function updateGlass(
  id: string,
  patch: Partial<GlassInput>
): Promise<Glass> {
  const { data, error } = await supabase
    .from("travel_glasses")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Glass;
}

export async function deleteGlass(id: string): Promise<void> {
  const { error } = await supabase.from("travel_glasses").delete().eq("id", id);
  if (error) throw error;
}

/* -------------------------------- Photos --------------------------------- */

export async function addPhoto(
  glassId: string,
  url: string,
  caption: string | null,
  sortOrder: number
): Promise<Photo> {
  const { data, error } = await supabase
    .from("travel_photos")
    .insert([{ glass_id: glassId, url, caption, sort_order: sortOrder }])
    .select()
    .single();
  if (error) throw error;
  return data as Photo;
}

export async function updatePhoto(
  id: string,
  patch: Partial<Pick<Photo, "caption" | "sort_order">>
): Promise<Photo> {
  const { data, error } = await supabase
    .from("travel_photos")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Photo;
}

export async function deletePhoto(id: string): Promise<void> {
  const { error } = await supabase.from("travel_photos").delete().eq("id", id);
  if (error) throw error;
}

/* -------------------------------- Storage -------------------------------- */

// Upload a file to the public bucket and return its public URL.
export async function uploadImage(
  file: File,
  folder: string
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Avoid Date.now()/Math.random(): build a key from name + size + a counter.
  const uniquePrefix = `${file.size.toString(36)}-${uploadCounter++}`;
  const path = `${folder}/${uniquePrefix}-${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Module-level counter keeps upload keys unique within a session without
// relying on Date.now()/Math.random().
let uploadCounter = 0;
