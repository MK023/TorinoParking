import { useEffect, useState } from "react";
import type { Parking, Snapshot } from "../types/parking";
import { getParkingHistory } from "../services/api";
import { getStatusColor, getNavigationUrl } from "../utils/parking";
import {
  ChevronLeft, MapPin, Euro, Moon, Calendar, CreditCard, Cash,
  Bus, Train, Roof, Clock, Shield, Camera, Accessibility, Navigation,
} from "./Icons";

interface HourBucket {
  label: string;
  avgOccupancy: number;
  avgFree: number | null;
  totalSpots: number;
  timestamp: number;
}

function aggregateByHour(snapshots: Snapshot[]): HourBucket[] {
  const buckets = new Map<string, { occupancy: number[]; free: number[]; total: number; ts: number }>();

  for (const s of snapshots) {
    const d = new Date(s.recorded_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;

    if (!buckets.has(key)) {
      buckets.set(key, { occupancy: [], free: [], total: s.total_spots, ts: d.getTime() });
    }
    const b = buckets.get(key)!;
    if (s.free_spots !== null && s.total_spots > 0) {
      b.occupancy.push(((s.total_spots - s.free_spots) / s.total_spots) * 100);
      b.free.push(s.free_spots);
    }
  }

  const result: HourBucket[] = [];
  for (const [, val] of buckets) {
    if (val.occupancy.length === 0) continue;
    const avgOcc = val.occupancy.reduce((a, b) => a + b, 0) / val.occupancy.length;
    const avgFree = val.free.reduce((a, b) => a + b, 0) / val.free.length;
    const d = new Date(val.ts);
    result.push({
      label: d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }).replace(/:\d{2}$/, ":00"),
      avgOccupancy: avgOcc,
      avgFree: Math.round(avgFree),
      totalSpots: val.total,
      timestamp: val.ts,
    });
  }

  return result.sort((a, b) => a.timestamp - b.timestamp);
}

function getBarColor(pct: number): string {
  if (pct >= 90) return "#ef4444";
  if (pct >= 70) return "#f59e0b";
  return "#22c55e";
}

function paymentIcon(method: string) {
  const m = method.toLowerCase();
  if (m.includes("contant") || m.includes("monete") || m.includes("cash"))
    return <Cash size={12} />;
  return <CreditCard size={12} />;
}

interface Props {
  parking: Parking;
  onBack: () => void;
}

export default function ParkingDetail({ parking, onBack }: Props) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [tooltipIdx, setTooltipIdx] = useState<number | null>(null);
  const color = getStatusColor(parking);
  const d = parking.detail;

  useEffect(() => {
    setLoadingHistory(true);
    getParkingHistory(parking.id, 6)
      .then((res) => setSnapshots(res.snapshots))
      .catch(() => setSnapshots([]))
      .finally(() => setLoadingHistory(false));
  }, [parking.id]);

  const hourBuckets = aggregateByHour(snapshots);

  const hasRates =
    d &&
    (d.hourly_rate_daytime !== null ||
      d.hourly_rate_nighttime !== null ||
      d.daily_rate !== null ||
      d.monthly_subscription !== null);

  const hasTags =
    d &&
    (d.is_covered ||
      d.open_24h ||
      d.is_custodied ||
      (d.disabled_spots !== null && d.disabled_spots > 0) ||
      (d.cameras !== null && d.cameras > 0));

  return (
    <div className="detail-panel">
      {/* Back button */}
      <button className="detail-back" onClick={onBack}>
        <ChevronLeft />
        Torna alla lista
      </button>

      {/* 1. Header */}
      <div className="detail-header">
        <h2>{parking.name}</h2>
        <span className="detail-status-badge" style={{ background: color }}>
          {parking.status_label}
        </span>
      </div>

      {/* 2. Availability */}
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

      {/* 3. Navigate button */}
      {parking.lat && parking.lng && (
        <a
          className="navigate-btn"
          href={getNavigationUrl(parking.lat, parking.lng)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Navigation size={18} />
          Naviga verso questo parcheggio
        </a>
      )}

      {d ? (
        <div className="detail-info-grid">
          {/* 4. Location */}
          {(d.address || d.district) && (
            <div className="detail-row">
              <span className="detail-icon"><MapPin size={16} /></span>
              <div>
                <span className="detail-key">Posizione</span>
                <span className="detail-val">
                  {d.address}
                  {d.address && d.district && " \u2014 "}
                  {d.district}
                </span>
              </div>
            </div>
          )}

          {/* 5. Rates grid */}
          {hasRates && (
            <div className="detail-section">
              <span className="detail-section-title">Tariffe</span>
              <div className="rates-grid">
                {d.hourly_rate_daytime !== null && (
                  <div className="rate-cell">
                    <Euro size={14} />
                    <div>
                      <span className="rate-value">{d.hourly_rate_daytime.toFixed(2)}/h</span>
                      <span className="rate-label">Giorno</span>
                    </div>
                  </div>
                )}
                {d.hourly_rate_nighttime !== null && (
                  <div className="rate-cell">
                    <Moon size={14} />
                    <div>
                      <span className="rate-value">{d.hourly_rate_nighttime.toFixed(2)}/h</span>
                      <span className="rate-label">Notte</span>
                    </div>
                  </div>
                )}
                {d.daily_rate !== null && (
                  <div className="rate-cell">
                    <Calendar size={14} />
                    <div>
                      <span className="rate-value">{d.daily_rate.toFixed(2)}</span>
                      <span className="rate-label">Giornaliera</span>
                    </div>
                  </div>
                )}
                {d.monthly_subscription !== null && (
                  <div className="rate-cell">
                    <Calendar size={14} />
                    <div>
                      <span className="rate-value">{d.monthly_subscription.toFixed(2)}</span>
                      <span className="rate-label">Mensile</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 6. Payment badges */}
          {d.payment_methods.length > 0 && (
            <div className="detail-section">
              <span className="detail-section-title">Pagamento</span>
              <div className="payment-badges">
                {d.payment_methods.map((m) => (
                  <span key={m} className="payment-badge">
                    {paymentIcon(m)}
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 7. Transport */}
          {(d.bus_lines.length > 0 || d.has_metro_access) && (
            <div className="detail-row">
              <span className="detail-icon"><Bus size={16} /></span>
              <div>
                <span className="detail-key">Trasporti</span>
                <div className="detail-tags">
                  {d.bus_lines.map((line) => (
                    <span key={line} className="tag">{line}</span>
                  ))}
                  {d.has_metro_access && (
                    <span className="tag tag-metro"><Train size={12} /> Metro</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 8. Features */}
          {hasTags && (
            <div className="detail-section">
              <span className="detail-section-title">Caratteristiche</span>
              <div className="detail-tags">
                {d.is_covered && (
                  <span className="tag"><Roof size={12} /> Coperto</span>
                )}
                {d.open_24h && (
                  <span className="tag"><Clock size={12} /> 24h</span>
                )}
                {d.is_custodied && (
                  <span className="tag"><Shield size={12} /> Custodito</span>
                )}
                {d.disabled_spots !== null && d.disabled_spots > 0 && (
                  <span className="tag"><Accessibility size={12} /> {d.disabled_spots} disabili</span>
                )}
                {d.cameras !== null && d.cameras > 0 && (
                  <span className="tag"><Camera size={12} /> {d.cameras} telecamere</span>
                )}
              </div>
            </div>
          )}

          {/* 9. Notes */}
          {d.notes && <p className="detail-notes">{d.notes}</p>}
        </div>
      ) : (
        <p className="detail-no-data">
          Dati dettagliati non disponibili per questo parcheggio
        </p>
      )}

      {/* 10. History chart */}
      <div className="detail-history">
        <h3>Storico (6h)</h3>
        {loadingHistory ? (
          <p className="loading-text">Caricamento storico...</p>
        ) : hourBuckets.length === 0 ? (
          <p className="empty-text">Nessun dato storico disponibile</p>
        ) : (
          <div className="history-chart">
            {hourBuckets.map((b, i) => (
              <div
                key={i}
                className="history-bar-wrapper"
                onClick={() => setTooltipIdx(tooltipIdx === i ? null : i)}
              >
                {tooltipIdx === i && (
                  <div className="history-tooltip">
                    {b.label} - {b.avgFree} liberi su {b.totalSpots}
                  </div>
                )}
                <div
                  className="history-bar"
                  style={{
                    height: `${b.avgOccupancy}%`,
                    background: getBarColor(b.avgOccupancy),
                  }}
                />
                <span className="history-time">{b.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
