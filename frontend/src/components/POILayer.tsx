import { Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import type { POI, POICategory } from "../types/poi";
import type { Parking } from "../types/parking";
import { haversineMeters } from "../utils/parking";

interface Props {
  pois: POI[];
  activeLayers: Set<POICategory>;
  parkings: Parking[];
  selectedPOI: POI | null;
  onSelectPOI: (poi: POI | null) => void;
}

function createPOIIcon(category: POICategory): L.DivIcon {
  const isHospital = category === "hospital";
  const bg = isHospital ? "#dc2626" : "#8b5cf6";
  const symbol = isHospital ? "+" : "U";

  return L.divIcon({
    className: "poi-marker",
    html: `
      <div style="
        background: ${bg};
        color: white;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 800;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      ">${symbol}</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
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
      {visiblePOIs.map((poi) => (
        <Marker
          key={poi.id}
          position={[poi.lat, poi.lng]}
          icon={createPOIIcon(poi.category)}
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
      ))}

      {selectedPOI && nearestParkings.map((p) => (
        <Polyline
          key={`line-${selectedPOI.id}-${p.id}`}
          positions={[
            [selectedPOI.lat, selectedPOI.lng],
            [p.lat, p.lng],
          ]}
          pathOptions={{
            color: "#3b82f6",
            weight: 2,
            dashArray: "6 4",
            opacity: 0.7,
          }}
        />
      ))}
    </>
  );
}
