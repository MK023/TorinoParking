import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import type { Parking } from "../types/parking";
import type { POI, POICategory } from "../types/poi";
import type { Theme } from "../hooks/useTheme";
import { getStatusColor, getTendenceInfo } from "../utils/parking";
import POILayer, { getNearestParkings } from "./POILayer";
import MapLegend from "./MapLegend";
import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";

const MAPBOX_TOKEN = "pk.eyJ1IjoiZW1tZWthcHBhMjMiLCJhIjoiY21sdGEzNjMzMGRiOTNmc2c1NjNkajd6dSJ9.u12KMwhY74Krp4vW2HE5cw";

const TILE_URLS: Record<Theme, string> = {
  dark: `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
  light: `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
};

const TORINO_CENTER: [number, number] = [45.0703, 7.6869];
const DEFAULT_ZOOM = 13;

// Limiti mappa: solo Torino città, niente comuni limitrofi
const TORINO_BOUNDS: L.LatLngBoundsExpression = [
  [45.005, 7.58],  // sud-ovest
  [45.14, 7.78],   // nord-est
];

function createIcon(parking: Parking, dimmed = false): L.DivIcon {
  const color = getStatusColor(parking);
  const spots = parking.free_spots !== null ? parking.free_spots : "\u2014";
  const nearlyFull = parking.is_available && parking.occupancy_percentage !== null && parking.occupancy_percentage >= 90;

  if (nearlyFull) {
    // Triangolo rovesciato per parcheggi quasi esauriti
    return L.divIcon({
      className: "parking-marker parking-marker-triangle",
      html: `
        <div style="
          width: 0; height: 0;
          border-left: 20px solid transparent;
          border-right: 20px solid transparent;
          border-top: 34px solid ${color};
          filter: drop-shadow(0 2px 4px rgba(0,0,0,${dimmed ? "0.1" : "0.4"}));
          opacity: ${dimmed ? 0.25 : 1};
          transition: opacity 0.3s ease;
          position: relative;
        ">
          <span style="
            position: absolute;
            top: -32px;
            left: -8px;
            width: 16px;
            text-align: center;
            color: white;
            font-size: 10px;
            font-weight: 700;
          ">${spots}</span>
        </div>
      `,
      iconSize: [40, 34],
      iconAnchor: [20, 4],
      popupAnchor: [0, -2],
    });
  }

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

function createClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount();
  return L.divIcon({
    className: "parking-cluster",
    html: `<div style="
      background: var(--accent, #3b82f6);
      color: white;
      border-radius: 50%;
      width: 42px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    ">${count}</div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
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
      maxBounds={TORINO_BOUNDS}
      maxBoundsViscosity={1.0}
      minZoom={12}
      maxZoom={18}
    >
      <TileLayer
        key={theme}
        attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url={TILE_URLS[theme]}
        tileSize={512}
        zoomOffset={-1}
      />
      <MapClickHandler onClick={onMapClick} />

      {userPosition && <FlyTo center={flyTarget} zoom={flyZoom} />}

      {userPosition && (
        <Marker
          position={userPosition}
          icon={L.divIcon({
            className: "user-marker",
            html: `<div style="
              width: 18px; height: 18px;
              background: linear-gradient(135deg, #60a5fa, #3b82f6);
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 0 12px rgba(59,130,246,0.5), 0 2px 4px rgba(0,0,0,0.2);
            "></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          })}
        />
      )}

      <MarkerClusterGroup
        key={selectedPOI ? "no-cluster" : "cluster"}
        maxClusterRadius={selectedPOI ? 0 : 35}
        spiderfyOnMaxZoom
        showCoverageOnHover={false}
        iconCreateFunction={createClusterIcon}
      >
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
                <div style={{ minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <strong style={{ fontSize: 14 }}>{p.name}</strong>
                    {p.free_spots !== null && (
                      <span style={{
                        fontSize: 18, fontWeight: 800, color: getStatusColor(p),
                        letterSpacing: -1, lineHeight: 1,
                      }}>{p.free_spots}</span>
                    )}
                  </div>
                  <div style={{ margin: "6px 0", fontSize: 12 }}>
                    {p.is_available ? (
                      <span style={{ color: "var(--text-secondary)" }}>
                        {p.free_spots} / {p.total_spots} posti liberi
                      </span>
                    ) : (
                      <span style={{ color: "#ef4444", fontWeight: 600 }}>{p.status_label}</span>
                    )}
                    {tendence.icon && (
                      <span style={{ fontSize: 11, opacity: 0.7 }}>
                        {" "}{tendence.icon} {tendence.text}
                      </span>
                    )}
                  </div>
                  {p.occupancy_percentage !== null && (
                    <div style={{
                      height: 5,
                      background: "var(--border)",
                      borderRadius: 3,
                      overflow: "hidden",
                      marginTop: 6,
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${p.occupancy_percentage}%`,
                        background: getStatusColor(p),
                        borderRadius: 3,
                        transition: "width 0.8s cubic-bezier(0.32, 0.72, 0, 1)",
                      }} />
                    </div>
                  )}
                  {p.detail?.address && (
                    <div style={{ fontSize: 11, marginTop: 8, color: "var(--text-muted)" }}>
                      {p.detail.address}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MarkerClusterGroup>

      {pois && activePOILayers && onSelectPOI && (
        <POILayer
          pois={pois}
          activeLayers={activePOILayers}
          parkings={parkings}
          selectedPOI={selectedPOI ?? null}
          onSelectPOI={onSelectPOI}
        />
      )}

      <MapLegend />
    </MapContainer>
  );
}
