import { useState } from "react";
import type { Parking } from "../types/parking";
import type { Filters as FilterState } from "../hooks/useParkings";
import ParkingCard from "./ParkingCard";
import ParkingDetail from "./ParkingDetail";
import Filters from "./Filters";
import NearestParkingBanner from "./NearestParkingBanner";
import { Search, Crosshair, Refresh } from "./Icons";

interface Props {
  parkings: Parking[];
  allParkings: Parking[];
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
  allParkings,
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

  const availableCount = allParkings.filter((p) => p.is_available).length;
  const totalSpots = allParkings.reduce((sum, p) => sum + (p.free_spots || 0), 0);

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
            <span className="stat-value">{allParkings.length}</span>
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
              <Search />
              <input
                type="text"
                placeholder="Cerca parcheggio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="action-buttons">
              <button className="btn btn-locate" onClick={onLocateMe} title="Trova vicino a me">
                <Crosshair />
                Vicino a me
              </button>
              <button className="btn btn-refresh" onClick={onRefresh} title="Aggiorna dati">
                <Refresh />
              </button>
            </div>

            <Filters filters={filters} onChange={onFilterChange} />
          </div>

          {filters.nearbyMode && filters.userLat !== null && filters.userLng !== null && (
            <NearestParkingBanner
              parkings={parkings}
              userLat={filters.userLat}
              userLng={filters.userLng}
              onSelect={onSelect}
            />
          )}

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
