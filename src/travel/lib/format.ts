// Small formatting helpers for the Travel section.
import { format, parseISO } from "date-fns";

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return format(parseISO(iso), "MMM d, yyyy");
  } catch {
    return "";
  }
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return format(parseISO(iso), "MMM d, yyyy · h:mm a");
  } catch {
    return "";
  }
}

export function getYear(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return format(parseISO(iso), "yyyy");
  } catch {
    return null;
  }
}

export function formatDateRange(
  start: string | null,
  end: string | null
): string {
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start) return formatDate(start);
  if (end) return formatDate(end);
  return "";
}

// Best-effort country extraction from a "City, Country" place string.
export function countryFromPlace(place: string | null): string | null {
  if (!place) return null;
  const parts = place.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}
