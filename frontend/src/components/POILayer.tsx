import { Marker, Polyline, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import type { POI, POICategory } from "../types/poi";
import type { Parking } from "../types/parking";
import { haversineMeters } from "../utils/parking";

function createPOIClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount();
  return L.divIcon({
    className: "poi-cluster",
    html: `<div style="
      background: #6366f1;
      color: white;
      border-radius: 6px;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      border: 2px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    ">${count}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

interface Props {
  pois: POI[];
  activeLayers: Set<POICategory>;
  parkings: Parking[];
  selectedPOI: POI | null;
  onSelectPOI: (poi: POI | null) => void;
}

function createPOIIcon(
  category: POICategory,
  selected: boolean,
  dimmed: boolean,
): L.DivIcon {
  const isHospital = category === "hospital";
  const bg = isHospital ? "#0891b2" : "#8b5cf6";
  const symbol = isHospital ? "H" : "U";
  const glowColor = isHospital ? "rgba(8,145,178,0.35)" : "rgba(139,92,246,0.35)";

  const size = selected ? 40 : 28;
  const fontSize = selected ? 17 : 13;
  const border = selected ? 3 : 2;
  const opacity = dimmed ? 0.25 : 1;

  const shadow = selected
    ? `0 0 0 5px ${glowColor}, 0 2px 10px rgba(0,0,0,0.4)`
    : `0 2px 6px rgba(0,0,0,${dimmed ? "0.1" : "0.35"})`;

  if (!isHospital) {
    // University: diamond (rotated square) — distinct from circles and rounded squares
    const inner = Math.round(size * 0.72);
    const innerFont = Math.round(fontSize * 0.95);
    return L.divIcon({
      className: "poi-marker",
      html: `
        <div style="
          width: ${size}px; height: ${size}px;
          display: flex; align-items: center; justify-content: center;
          opacity: ${opacity}; transition: opacity 0.3s ease;
        ">
          <div style="
            background: ${bg}; color: white;
            width: ${inner}px; height: ${inner}px;
            transform: rotate(45deg);
            border-radius: 4px;
            display: flex; align-items: center; justify-content: center;
            font-size: ${innerFont}px; font-weight: 800;
            border: ${border}px solid white;
            box-shadow: ${shadow};
          "><span style="transform: rotate(-45deg); display: block;">${symbol}</span></div>
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -(size / 2 + 4)],
    });
  }

  // Hospital: rounded square
  return L.divIcon({
    className: "poi-marker",
    html: `
      <div style="
        background: ${bg};
        color: white;
        border-radius: 6px;
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${fontSize}px;
        font-weight: 800;
        border: ${border}px solid white;
        box-shadow: ${shadow};
        opacity: ${opacity};
        transition: opacity 0.3s ease;
      ">${symbol}</div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

export function getNearestParkings(poi: POI, parkings: Parking[], count: number = 3): (Parking & { distance: number })[] {
  return parkings
    .filter((p) => p.is_available && p.free_spots !== null && p.free_spots > 0)
    .map((p) => ({
      ...p,
      distance: haversineMeters(poi.lat, poi.lng, p.lat, p.lng),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count);
}

export default function POILayer({
  pois,
  activeLayers,
  parkings,
  selectedPOI,
  onSelectPOI,
}: Props) {
  const visiblePOIs = pois.filter((p) => activeLayers.has(p.category));
  const nearestParkings = selectedPOI ? getNearestParkings(selectedPOI, parkings) : [];

  return (
    <>
      <MarkerClusterGroup
        maxClusterRadius={30}
        spiderfyOnMaxZoom
        showCoverageOnHover={false}
        iconCreateFunction={createPOIClusterIcon}
      >
        {visiblePOIs.map((poi) => {
          const isSelected = selectedPOI?.id === poi.id;
          const isDimmed = selectedPOI !== null && !isSelected;
          return (
            <Marker
              key={poi.id}
              position={[poi.lat, poi.lng]}
              icon={createPOIIcon(poi.category, isSelected, isDimmed)}
              zIndexOffset={isSelected ? 2000 : isDimmed ? -500 : 0}
              eventHandlers={{ click: () => onSelectPOI(poi) }}
            >
              <Popup>
                <div style={{ minWidth: 160 }}>
                  <strong>{poi.name}</strong>
                  <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>
                    {poi.address}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MarkerClusterGroup>

      {selectedPOI && nearestParkings.map((p) => (
        <Polyline
          key={`line-${selectedPOI.id}-${p.id}`}
          positions={[
            [selectedPOI.lat, selectedPOI.lng],
            [p.lat, p.lng],
          ]}
          pathOptions={{
            color: "#3b82f6",
            weight: 1.5,
            opacity: 0.45,
          }}
        />
      ))}
    </>
  );
}
