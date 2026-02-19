import type { Parking } from "../types/parking";
import { getStatusColor, getTendenceInfo } from "../utils/parking";

interface Props {
  parking: Parking;
  onClick: () => void;
}

export default function ParkingCard({ parking, onClick }: Props) {
  const color = getStatusColor(parking);
  const tendence = getTendenceInfo(parking.tendence, parking);
  const d = parking.detail;

  const nearlyFull = parking.is_available && parking.occupancy_percentage !== null && parking.occupancy_percentage >= 90;

  return (
    <div className="parking-card" onClick={onClick}>
      <div className="parking-card-header">
        {nearlyFull ? (
          <div className="parking-card-indicator-triangle" style={{ borderTopColor: color }} />
        ) : (
          <div className="parking-card-indicator" style={{ background: color }} />
        )}
        <div className="parking-card-info">
          <h3>{parking.name}</h3>
          {d?.address && (
            <p className="parking-card-address">{d.address}</p>
          )}
        </div>
        <div className="parking-card-spots">
          {parking.free_spots !== null ? (
            <>
              <span className="spots-number" style={{ color }}>
                {parking.free_spots}
              </span>
              <span className="spots-label">liberi</span>
            </>
          ) : (
            <span className="spots-label">{parking.status_label}</span>
          )}
        </div>
      </div>

      {parking.occupancy_percentage !== null && (
        <div className="parking-card-bar">
          <div
            className="parking-card-bar-fill"
            style={{
              width: `${parking.occupancy_percentage}%`,
              background: color,
            }}
          />
        </div>
      )}

      <div className="parking-card-footer">
        <span>{parking.total_spots} posti totali</span>
        {parking.tendence !== null && (
          <span className="tendence" style={{ color }}>
            {tendence.icon} {tendence.text}
          </span>
        )}
        {d?.operator && (
          <span className="has-detail-badge">{d.operator}</span>
        )}
      </div>

      {d && (
        <div className="parking-card-tags">
          {d.hourly_rate_daytime !== null && (
            <span className="card-tag card-tag-price">&euro;{d.hourly_rate_daytime.toFixed(2)}/h</span>
          )}
          {d.is_covered && <span className="card-tag">Coperto</span>}
          {d.open_24h && <span className="card-tag">24h</span>}
          {d.has_metro_access && <span className="card-tag card-tag-metro">Metro</span>}
          {d.disabled_spots !== null && d.disabled_spots > 0 && (
            <span className="card-tag">{d.disabled_spots} disabili</span>
          )}
        </div>
      )}
    </div>
  );
}
