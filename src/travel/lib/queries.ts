// React Query hooks for the Travel section.
// The app already provides a QueryClientProvider in src/App.tsx.

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as api from "./api";
import type { GlassInput, TripInput } from "./types";

const GLASSES_KEY = ["travel", "glasses"] as const;
const TRIPS_KEY = ["travel", "trips"] as const;

export function useGlasses() {
  return useQuery({ queryKey: GLASSES_KEY, queryFn: api.fetchGlasses });
}

export function useTrips() {
  return useQuery({ queryKey: TRIPS_KEY, queryFn: api.fetchTrips });
}

// Invalidate everything travel-related after a mutation so joined data
// (glass -> photos -> trip) stays consistent.
function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: GLASSES_KEY });
    qc.invalidateQueries({ queryKey: TRIPS_KEY });
  };
}

/* -------------------------------- Trips ---------------------------------- */

export function useCreateTrip() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: TripInput) => api.createTrip(input),
    onSuccess: invalidate,
  });
}

export function useUpdateTrip() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<TripInput> }) =>
      api.updateTrip(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteTrip() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.deleteTrip(id),
    onSuccess: invalidate,
  });
}

/* ------------------------------- Glasses --------------------------------- */

export function useCreateGlass() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: GlassInput) => api.createGlass(input),
    onSuccess: invalidate,
  });
}

export function useUpdateGlass() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<GlassInput> }) =>
      api.updateGlass(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteGlass() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.deleteGlass(id),
    onSuccess: invalidate,
  });
}

/* -------------------------------- Photos --------------------------------- */

export function useAddPhoto() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({
      glassId,
      url,
      caption,
      sortOrder,
    }: {
      glassId: string;
      url: string;
      caption: string | null;
      sortOrder: number;
    }) => api.addPhoto(glassId, url, caption, sortOrder),
    onSuccess: invalidate,
  });
}

export function useDeletePhoto() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.deletePhoto(id),
    onSuccess: invalidate,
  });
}
