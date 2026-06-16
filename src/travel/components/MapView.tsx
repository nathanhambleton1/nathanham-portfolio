// Interactive map of all located glasses, using react-leaflet + OpenStreetMap
// (no API key). Pins are custom divIcons so we avoid Leaflet's broken default
// marker-image issue under bundlers.

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GlassWithDetails } from "../lib/types";
import { formatDate } from "../lib/format";

interface Props {
  glasses: GlassWithDetails[];
  onSelect: (g: GlassWithDetails) => void;
}

const pinIcon = L.divIcon({
  className: "tv-pin-wrap",
  html: '<div class="tv-pin"><span>🥃</span></div>',
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -36],
});

// Pan/zoom to fit all pins whenever the located set changes.
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 6);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48] });
  }, [map, points]);
  return null;
}

export default function MapView({ glasses, onSelect }: Props) {
  const located = useMemo(
    () =>
      glasses.filter(
        (g) => typeof g.latitude === "number" && typeof g.longitude === "number"
      ),
    [glasses]
  );

  const points = useMemo(
    () => located.map((g) => [g.latitude as number, g.longitude as number] as [number, number]),
    [located]
  );

  return (
    <div className="relative">
      {located.length === 0 && (
        <div className="absolute inset-0 z-[500] grid place-items-center rounded-[14px] bg-black/5 text-center">
          <p className="tv-handwritten text-2xl text-[var(--tv-ink)]">
            No mapped locations yet
          </p>
        </div>
      )}
      <MapContainer
        center={[30, 10]}
        zoom={2}
        scrollWheelZoom
        style={{ height: "min(70vh, 620px)", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {located.map((g) => (
          <Marker
            key={g.id}
            position={[g.latitude as number, g.longitude as number]}
            icon={pinIcon}
          >
            <Popup>
              <div className="min-w-[140px]">
                {(g.photos[0]?.url ?? g.glass_url) && (
                  <img
                    src={g.photos[0]?.url ?? g.glass_url ?? ""}
                    alt={g.location_name}
                    className="mb-1.5 h-20 w-full rounded object-cover"
                  />
                )}
                <div className="font-semibold">{g.location_name}</div>
                {g.place_detail && (
                  <div className="text-xs text-neutral-500">{g.place_detail}</div>
                )}
                {g.collected_at && (
                  <div className="text-xs text-neutral-500">
                    {formatDate(g.collected_at)}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onSelect(g)}
                  className="mt-1.5 text-xs font-semibold text-[#d9794f] underline"
                >
                  View memory →
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
