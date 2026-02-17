import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { Parking } from "../types/parking";
import "leaflet/dist/leaflet.css";

const TORINO_CENTER: [number, number] = [45.0703, 7.6869];
const DEFAULT_ZOOM = 13;

function getMarkerColor(parking: Parking): string {
  if (!parking.is_available) return "#6b7280"; // gray
  if (parking.occupancy_percentage === null) return "#6b7280";
  if (parking.occupancy_percentage >= 90) return "#ef4444"; // red
  if (parking.occupancy_percentage >= 70) return "#f59e0b"; // amber
  return "#22c55e"; // green
}

function createIcon(parking: Parking): L.DivIcon {
  const color = getMarkerColor(parking);
  const spots = parking.free_spots !== null ? parking.free_spots : "—";
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
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      ">${spots}</div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

function formatTendence(t: number | null): string {
  if (t === null) return "";
  if (t > 0) return " ↑ si sta liberando";
  if (t < 0) return " ↓ si sta riempiendo";
  return " → stabile";
}

interface FlyToProps {
  center: [number, number];
  zoom: number;
}

function FlyTo({ center, zoom }: FlyToProps) {
  const map = useMap();
  map.flyTo(center, zoom, { duration: 1.2 });
  return null;
}

interface Props {
  parkings: Parking[];
  selectedId: number | null;
  onSelect: (parking: Parking) => void;
  userPosition: [number, number] | null;
}

export default function ParkingMap({ parkings, selectedId, onSelect, userPosition }: Props) {
  const flyTarget = userPosition || TORINO_CENTER;
  const flyZoom = userPosition ? 15 : DEFAULT_ZOOM;

  return (
    <MapContainer
      center={TORINO_CENTER}
      zoom={DEFAULT_ZOOM}
      className="parking-map"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

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

      {parkings.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={createIcon(p)}
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
                <span style={{ fontSize: 11, opacity: 0.7 }}>
                  {formatTendence(p.tendence)}
                </span>
              </div>
              {p.occupancy_percentage !== null && (
                <div style={{
                  height: 6,
                  background: "#374151",
                  borderRadius: 3,
                  overflow: "hidden",
                  marginTop: 4,
                }}>
                  <div style={{
                    height: "100%",
                    width: `${p.occupancy_percentage}%`,
                    background: getMarkerColor(p),
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
      ))}
    </MapContainer>
  );
}
