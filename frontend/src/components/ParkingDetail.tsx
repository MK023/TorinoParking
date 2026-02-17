import { useEffect, useState } from "react";
import type { Parking, Snapshot } from "../types/parking";
import { getParkingHistory } from "../services/api";

function getStatusColor(parking: Parking): string {
  if (!parking.is_available) return "#6b7280";
  if (parking.occupancy_percentage === null) return "#6b7280";
  if (parking.occupancy_percentage >= 90) return "#ef4444";
  if (parking.occupancy_percentage >= 70) return "#f59e0b";
  return "#22c55e";
}

interface Props {
  parking: Parking;
  onBack: () => void;
}

export default function ParkingDetail({ parking, onBack }: Props) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const color = getStatusColor(parking);
  const d = parking.detail;

  useEffect(() => {
    setLoadingHistory(true);
    getParkingHistory(parking.id, 6)
      .then((res) => setSnapshots(res.snapshots))
      .catch(() => setSnapshots([]))
      .finally(() => setLoadingHistory(false));
  }, [parking.id]);

  return (
    <div className="detail-panel">
      <button className="detail-back" onClick={onBack}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Torna alla lista
      </button>

      <div className="detail-header">
        <h2>{parking.name}</h2>
        <span className="detail-status-badge" style={{ background: color }}>
          {parking.status_label}
        </span>
      </div>

      <div className="detail-spots-big">
        {parking.free_spots !== null ? (
          <>
            <span className="big-number" style={{ color }}>
              {parking.free_spots}
            </span>
            <span className="big-label">
              posti liberi su {parking.total_spots}
            </span>
          </>
        ) : (
          <span className="big-label">Dati non disponibili</span>
        )}
      </div>

      {parking.occupancy_percentage !== null && (
        <div className="detail-bar">
          <div
            className="detail-bar-fill"
            style={{
              width: `${parking.occupancy_percentage}%`,
              background: color,
            }}
          />
          <span className="detail-bar-label">
            {parking.occupancy_percentage.toFixed(0)}% occupato
          </span>
        </div>
      )}

      {d && (
        <div className="detail-info-grid">
          {d.address && (
            <div className="detail-row">
              <span className="detail-icon">📍</span>
              <div>
                <span className="detail-key">Indirizzo</span>
                <span className="detail-val">{d.address}</span>
              </div>
            </div>
          )}
          {d.district && (
            <div className="detail-row">
              <span className="detail-icon">🏘</span>
              <div>
                <span className="detail-key">Circoscrizione</span>
                <span className="detail-val">{d.district}</span>
              </div>
            </div>
          )}
          {d.hourly_rate_daytime !== null && (
            <div className="detail-row">
              <span className="detail-icon">💶</span>
              <div>
                <span className="detail-key">Tariffa oraria</span>
                <span className="detail-val">
                  €{d.hourly_rate_daytime.toFixed(2)}/h (giorno)
                  {d.hourly_rate_nighttime !== null &&
                    ` · €${d.hourly_rate_nighttime.toFixed(2)}/h (notte)`}
                </span>
              </div>
            </div>
          )}
          {d.daily_rate !== null && (
            <div className="detail-row">
              <span className="detail-icon">📅</span>
              <div>
                <span className="detail-key">Giornaliera</span>
                <span className="detail-val">€{d.daily_rate.toFixed(2)}</span>
              </div>
            </div>
          )}
          {d.monthly_subscription !== null && (
            <div className="detail-row">
              <span className="detail-icon">🗓</span>
              <div>
                <span className="detail-key">Abbonamento mensile</span>
                <span className="detail-val">€{d.monthly_subscription.toFixed(2)}</span>
              </div>
            </div>
          )}
          {d.payment_methods.length > 0 && (
            <div className="detail-row">
              <span className="detail-icon">💳</span>
              <div>
                <span className="detail-key">Pagamento</span>
                <span className="detail-val">{d.payment_methods.join(", ")}</span>
              </div>
            </div>
          )}
          {d.bus_lines.length > 0 && (
            <div className="detail-row">
              <span className="detail-icon">🚌</span>
              <div>
                <span className="detail-key">Linee bus</span>
                <span className="detail-val">
                  {d.bus_lines.join(", ")}
                  {d.has_metro_access && " · 🚇 Metro"}
                </span>
              </div>
            </div>
          )}
          <div className="detail-tags">
            {d.is_covered && <span className="tag">coperto</span>}
            {d.open_24h && <span className="tag">24h</span>}
            {d.is_custodied && <span className="tag">custodito</span>}
            {d.has_metro_access && <span className="tag">metro</span>}
            {d.disabled_spots !== null && d.disabled_spots > 0 && (
              <span className="tag">{d.disabled_spots} disabili</span>
            )}
            {d.cameras !== null && d.cameras > 0 && (
              <span className="tag">{d.cameras} telecamere</span>
            )}
          </div>
          {d.notes && <p className="detail-notes">{d.notes}</p>}
        </div>
      )}

      <div className="detail-history">
        <h3>Storico ultime 6 ore</h3>
        {loadingHistory ? (
          <p className="loading-text">Caricamento storico...</p>
        ) : snapshots.length === 0 ? (
          <p className="empty-text">Nessun dato storico disponibile</p>
        ) : (
          <div className="history-chart">
            {snapshots
              .slice()
              .reverse()
              .map((s, i) => {
                const pct =
                  s.free_spots !== null && s.total_spots > 0
                    ? ((s.total_spots - s.free_spots) / s.total_spots) * 100
                    : 0;
                return (
                  <div key={i} className="history-bar-wrapper">
                    <div
                      className="history-bar"
                      style={{
                        height: `${pct}%`,
                        background: pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#22c55e",
                      }}
                    />
                    <span className="history-time">
                      {new Date(s.recorded_at).toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
