import type { Parking } from "../types/parking";

function getStatusColor(parking: Parking): string {
  if (!parking.is_available) return "#6b7280";
  if (parking.occupancy_percentage === null) return "#6b7280";
  if (parking.occupancy_percentage >= 90) return "#ef4444";
  if (parking.occupancy_percentage >= 70) return "#f59e0b";
  return "#22c55e";
}

function getTendenceIcon(t: number | null): string {
  if (t === null) return "";
  if (t > 0) return "↑";
  if (t < 0) return "↓";
  return "→";
}

interface Props {
  parking: Parking;
  onClick: () => void;
}

export default function ParkingCard({ parking, onClick }: Props) {
  const color = getStatusColor(parking);

  return (
    <div className="parking-card" onClick={onClick}>
      <div className="parking-card-header">
        <div className="parking-card-indicator" style={{ background: color }} />
        <div className="parking-card-info">
          <h3>{parking.name}</h3>
          {parking.detail?.address && (
            <p className="parking-card-address">{parking.detail.address}</p>
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
            {getTendenceIcon(parking.tendence)}{" "}
            {parking.tendence > 0 ? "si libera" : parking.tendence < 0 ? "si riempie" : "stabile"}
          </span>
        )}
        {parking.detail && (
          <span className="has-detail-badge">GTT</span>
        )}
      </div>
    </div>
  );
}
