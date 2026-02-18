import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { Parking } from "../types/parking";
import type { POI, POICategory } from "../types/poi";
import type { Theme } from "../hooks/useTheme";
import { getStatusColor, getTendenceInfo } from "../utils/parking";
import POILayer, { getNearestParkings } from "./POILayer";
import "leaflet/dist/leaflet.css";

const TILE_URLS: Record<Theme, string> = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
};

const TORINO_CENTER: [number, number] = [45.0703, 7.6869];
const DEFAULT_ZOOM = 13;

function createIcon(parking: Parking, dimmed = false): L.DivIcon {
  const color = getStatusColor(parking);
  const spots = parking.free_spots !== null ? parking.free_spots : "\u2014";
  return L.divIcon({
    className: "parking-marker",
    html: `
      <div style="
        background: ${color};
        color: white;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,${dimmed ? "0.1" : "0.35"});
        opacity: ${dimmed ? 0.25 : 1};
        transition: opacity 0.3s ease;
      ">${spots}</div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

interface FlyToProps {
  center: [number, number];
  zoom: number;
}

function FlyTo({ center, zoom }: FlyToProps) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [map, center[0], center[1], zoom]);
  return null;
}

function MapClickHandler({ onClick }: { onClick?: () => void }) {
  const map = useMap();
  useEffect(() => {
    if (!onClick) return;
    const handler = (e: L.LeafletMouseEvent) => {
      const target = e.originalEvent.target as HTMLElement;
      if (target?.closest('.parking-marker, .poi-marker, .leaflet-popup')) return;
      onClick();
    };
    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, [map, onClick]);
  return null;
}

interface Props {
  parkings: Parking[];
  selectedId: number | null;
  onSelect: (parking: Parking) => void;
  userPosition: [number, number] | null;
  onMapClick?: () => void;
  pois?: POI[];
  activePOILayers?: Set<POICategory>;
  selectedPOI?: POI | null;
  onSelectPOI?: (poi: POI | null) => void;
  theme?: Theme;
}

export default function ParkingMap({ parkings, selectedId: _selectedId, onSelect, userPosition, onMapClick, pois, activePOILayers, selectedPOI, onSelectPOI, theme = "dark" }: Props) {
  const flyTarget = userPosition || TORINO_CENTER;
  const flyZoom = userPosition ? 15 : DEFAULT_ZOOM;

  const highlightedIds = selectedPOI
    ? new Set(getNearestParkings(selectedPOI, parkings).map((p) => p.id))
    : null;

  return (
    <MapContainer
      center={TORINO_CENTER}
      zoom={DEFAULT_ZOOM}
      className="parking-map"
      zoomControl={false}
    >
      <TileLayer
        key={theme}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url={TILE_URLS[theme]}
      />
      <MapClickHandler onClick={onMapClick} />

      {userPosition && <FlyTo center={flyTarget} zoom={flyZoom} />}

      {userPosition && (
        <Marker
          position={userPosition}
          icon={L.divIcon({
            className: "user-marker",
            html: `<div style="
              width: 16px; height: 16px;
              background: #3b82f6;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 0 12px rgba(59,130,246,0.6);
            "></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          })}
        />
      )}

      {parkings.map((p) => {
        const tendence = getTendenceInfo(p.tendence, p);
        const dimmed = highlightedIds !== null && !highlightedIds.has(p.id);
        const zOffset = highlightedIds === null ? 0 : dimmed ? -1000 : 1000;
        return (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={createIcon(p, dimmed)}
            zIndexOffset={zOffset}
            eventHandlers={{ click: () => onSelect(p) }}
          >
            <Popup>
              <div style={{ minWidth: 180 }}>
                <strong>{p.name}</strong>
                <div style={{ margin: "6px 0", fontSize: 13 }}>
                  {p.is_available ? (
                    <span style={{ color: "#22c55e" }}>
                      {p.free_spots} / {p.total_spots} posti liberi
                    </span>
                  ) : (
                    <span style={{ color: "#ef4444" }}>{p.status_label}</span>
                  )}
                  {tendence.icon && (
                    <span style={{ fontSize: 11, opacity: 0.7 }}>
                      {" "}{tendence.icon} {tendence.text}
                    </span>
                  )}
                </div>
                {p.occupancy_percentage !== null && (
                  <div style={{
                    height: 6,
                    background: "var(--border)",
                    borderRadius: 3,
                    overflow: "hidden",
                    marginTop: 4,
                  }}>
                    <div style={{
                      height: "100%",
                      width: `${p.occupancy_percentage}%`,
                      background: getStatusColor(p),
                      borderRadius: 3,
                      transition: "width 0.5s",
                    }} />
                  </div>
                )}
                {p.detail?.address && (
                  <div style={{ fontSize: 11, marginTop: 6, opacity: 0.7 }}>
                    {p.detail.address}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {pois && activePOILayers && onSelectPOI && (
        <POILayer
          pois={pois}
          activeLayers={activePOILayers}
          parkings={parkings}
          selectedPOI={selectedPOI ?? null}
          onSelectPOI={onSelectPOI}
        />
      )}
    </MapContainer>
  );
}
