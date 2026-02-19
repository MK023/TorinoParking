import type { Parking } from "../types/parking";
import { haversineMeters, formatDistance, getNavigationUrl } from "../utils/parking";
import { Navigation } from "./Icons";

interface Props {
  parkings: Parking[];
  userLat: number;
  userLng: number;
  onSelect: (parking: Parking) => void;
}

export default function NearestParkingBanner({ parkings, userLat, userLng, onSelect }: Props) {
  const available = parkings.filter(
    (p) => p.is_available && p.free_spots !== null && p.free_spots > 0
  );

  if (available.length === 0) {
    return (
      <div className="nearest-banner nearest-banner--empty">
        <span>Nessun parcheggio libero nelle vicinanze</span>
      </div>
    );
  }

  let nearest = available[0];
  let minDist = haversineMeters(userLat, userLng, nearest.lat, nearest.lng);

  for (let i = 1; i < available.length; i++) {
    const dist = haversineMeters(userLat, userLng, available[i].lat, available[i].lng);
    if (dist < minDist) {
      minDist = dist;
      nearest = available[i];
    }
  }

  return (
    <div className="nearest-banner" onClick={() => onSelect(nearest)}>
      <div className="nearest-banner-header">Parcheggio libero più vicino</div>
      <div className="nearest-banner-body">
        <div className="nearest-banner-info">
          <span className="nearest-banner-name">{nearest.name}</span>
          <span className="nearest-banner-dist">{formatDistance(minDist)}</span>
        </div>
        <span className="nearest-banner-spots">
          {nearest.free_spots}
          <small>liberi</small>
        </span>
      </div>
      <a
        className="nearest-banner-nav"
        href={getNavigationUrl(nearest.lat, nearest.lng)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        <Navigation size={16} />
        Naviga
      </a>
    </div>
  );
}
