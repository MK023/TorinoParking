import { useState } from "react";
import type { Parking } from "../types/parking";
import ParkingCard from "./ParkingCard";
import ParkingDetail from "./ParkingDetail";
import Filters from "./Filters";

interface FilterState {
  onlyAvailable: boolean;
  minSpots: number;
  nearbyMode: boolean;
  userLat: number | null;
  userLng: number | null;
  radius: number;
}

interface Props {
  parkings: Parking[];
  loading: boolean;
  error: string | null;
  lastUpdate: string | null;
  selectedParking: Parking | null;
  filters: FilterState;
  onFilterChange: (f: FilterState) => void;
  onSelect: (parking: Parking | null) => void;
  onLocateMe: () => void;
  onRefresh: () => void;
}

export default function Sidebar({
  parkings,
  loading,
  error,
  lastUpdate,
  selectedParking,
  filters,
  onFilterChange,
  onSelect,
  onLocateMe,
  onRefresh,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = parkings.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const availableCount = parkings.filter((p) => p.is_available).length;
  const totalSpots = parkings.reduce((sum, p) => sum + (p.free_spots || 0), 0);

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div className="logo">
          <span className="logo-icon">P</span>
          <div>
            <h1>Torino Parking</h1>
            <p className="subtitle">Disponibilita in tempo reale</p>
          </div>
        </div>
        <div className="stats-row">
          <div className="stat">
            <span className="stat-value">{parkings.length}</span>
            <span className="stat-label">parcheggi</span>
          </div>
          <div className="stat">
            <span className="stat-value">{availableCount}</span>
            <span className="stat-label">aperti</span>
          </div>
          <div className="stat">
            <span className="stat-value">{totalSpots.toLocaleString()}</span>
            <span className="stat-label">posti liberi</span>
          </div>
        </div>
      </header>

      {selectedParking ? (
        <ParkingDetail parking={selectedParking} onBack={() => onSelect(null)} />
      ) : (
        <>
          <div className="sidebar-controls">
            <div className="search-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Cerca parcheggio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="action-buttons">
              <button className="btn btn-locate" onClick={onLocateMe} title="Trova vicino a me">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v4m0 12v4m10-10h-4M6 12H2" />
                </svg>
                Vicino a me
              </button>
              <button className="btn btn-refresh" onClick={onRefresh} title="Aggiorna dati">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
              </button>
            </div>

            <Filters filters={filters} onChange={onFilterChange} />
          </div>

          <div className="parking-list">
            {loading && <div className="loading-spinner">Caricamento...</div>}
            {error && <div className="error-message">{error}</div>}
            {!loading && !error && filtered.length === 0 && (
              <div className="empty-state">Nessun parcheggio trovato</div>
            )}
            {filtered.map((p) => (
              <ParkingCard key={p.id} parking={p} onClick={() => onSelect(p)} />
            ))}
          </div>
        </>
      )}

      <footer className="sidebar-footer">
        {lastUpdate && (
          <span>
            Aggiornato: {new Date(lastUpdate).toLocaleTimeString("it-IT")}
          </span>
        )}
        <span>Dati: 5T Torino Open Data</span>
      </footer>
    </aside>
  );
}
