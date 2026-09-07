// Interactive map of all located glasses, using react-leaflet + OpenStreetMap
// (no API key). Pins are custom divIcons so we avoid Leaflet's broken default
// marker-image issue under bundlers.

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import { Home } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import type { GlassWithDetails } from "../lib/types";
import { formatDate } from "../lib/format";

interface Props {
  glasses: GlassWithDetails[];
  onSelect: (g: GlassWithDetails) => void;
}

const PIN_SIZE = 44;

// Esri's Light Gray Canvas basemap only has real cartographic data up to
// z16; beyond that we let Leaflet smoothly upscale those tiles so tightly
// clustered pins still have room to spread apart when zoomed in on.
const TILE_MAX_NATIVE_ZOOM = 16;
const TILE_MAX_ZOOM = 19;

// Pins scale up a bit as you zoom in, from a small world-view size to a
// larger, easier-to-tap size at street level.
const PIN_SCALE_MIN_ZOOM = 2;
const PIN_SCALE_MAX_ZOOM = 16;
const PIN_SCALE_MIN = 0.8;
const PIN_SCALE_MAX = 1.35;

function buildPinIcon(photoUrl?: string | null) {
  const inner = photoUrl
    ? `<img src="${photoUrl}" alt="" />`
    : "<span>🥃</span>";
  return L.divIcon({
    className: "tv-pin-wrap",
    html: `<div class="tv-pin-scale"><div class="tv-pin">${inner}</div></div>`,
    iconSize: [PIN_SIZE, PIN_SIZE],
    iconAnchor: [PIN_SIZE / 2, PIN_SIZE],
    popupAnchor: [0, -PIN_SIZE + 2],
  });
}

function createClusterIcon(cluster: { getChildCount: () => number }) {
  const count = cluster.getChildCount();
  const tier = count < 10 ? "sm" : count < 25 ? "md" : "lg";
  const size = tier === "sm" ? 38 : tier === "md" ? 46 : 54;
  return L.divIcon({
    className: `tv-cluster tv-cluster-${tier}`,
    html: `<div class="tv-cluster-inner">${count}</div>`,
    iconSize: L.point(size, size),
  });
}

function fitToPoints(map: L.Map, points: [number, number][]) {
  if (points.length === 0) return;
  if (points.length === 1) {
    map.setView(points[0], 6);
    return;
  }
  map.fitBounds(L.latLngBounds(points), { padding: [48, 48] });
}

// Pan/zoom to fit all pins whenever the located set changes.
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    fitToPoints(map, points);
  }, [map, points]);
  return null;
}

// Grows pins/clusters a bit as you zoom in, via a CSS var read by their icons.
function PinZoomScale() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const update = () => {
      const t = Math.min(
        1,
        Math.max(
          0,
          (map.getZoom() - PIN_SCALE_MIN_ZOOM) /
            (PIN_SCALE_MAX_ZOOM - PIN_SCALE_MIN_ZOOM)
        )
      );
      const scale = PIN_SCALE_MIN + t * (PIN_SCALE_MAX - PIN_SCALE_MIN);
      container.style.setProperty("--tv-pin-scale", scale.toFixed(3));
    };
    update();
    map.on("zoomend", update);
    return () => {
      map.off("zoomend", update);
    };
  }, [map]);
  return null;
}

// Button in the top-right corner that re-fits the map to all pins.
function ResetViewControl({ points }: { points: [number, number][] }) {
  const map = useMap();
  return (
    <button
      type="button"
      className="tv-map-reset"
      title="Reset view"
      onClick={() => fitToPoints(map, points)}
    >
      <Home size={16} />
    </button>
  );
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

  const icons = useMemo(
    () =>
      new Map(
        located.map((g) => [g.id, buildPinIcon(g.photos[0]?.url ?? g.glass_url)])
      ),
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
          attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          maxNativeZoom={TILE_MAX_NATIVE_ZOOM}
          maxZoom={TILE_MAX_ZOOM}
        />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
          maxNativeZoom={TILE_MAX_NATIVE_ZOOM}
          maxZoom={TILE_MAX_ZOOM}
        />
        <FitBounds points={points} />
        <PinZoomScale />
        <ResetViewControl points={points} />
        <MarkerClusterGroup
          iconCreateFunction={createClusterIcon}
          maxClusterRadius={50}
          showCoverageOnHover={false}
          spiderfyOnMaxZoom
        >
          {located.map((g) => (
            <Marker
              key={g.id}
              position={[g.latitude as number, g.longitude as number]}
              icon={icons.get(g.id) ?? buildPinIcon()}
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
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
