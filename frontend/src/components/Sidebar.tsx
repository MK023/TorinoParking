import { useState } from "react";
import type { Parking } from "../types/parking";
import type { POI, POICategory } from "../types/poi";
import type { Filters as FilterState } from "../hooks/useParkings";
import type { UseBottomSheetReturn } from "../hooks/useBottomSheet";
import ParkingCard from "./ParkingCard";
import ParkingDetail from "./ParkingDetail";
import Filters from "./Filters";
import NearestParkingBanner from "./NearestParkingBanner";
import { getNearestParkings } from "./POILayer";
import { formatDistance } from "../utils/parking";
import type { Theme } from "../hooks/useTheme";
import type { Weather } from "../hooks/useWeather";
import { Search, Crosshair, Refresh, ChevronLeft, ChevronRight, Sun, Moon } from "./Icons";

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
  isMobile: boolean;
  bottomSheet?: UseBottomSheetReturn;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  poiLayers?: Set<POICategory>;
  onTogglePOILayer?: (category: POICategory) => void;
  selectedPOI?: POI | null;
  onSelectPOI?: (poi: POI | null) => void;
  theme?: Theme;
  onToggleTheme?: () => void;
  weather?: Weather | null;
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
  isMobile,
  bottomSheet,
  collapsed,
  onToggleCollapse,
  poiLayers,
  onTogglePOILayer,
  selectedPOI,
  onSelectPOI,
  theme,
  onToggleTheme,
  weather,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = parkings.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const availableCount = allParkings.filter((p) => p.is_available).length;
  const totalSpots = allParkings.reduce((sum, p) => sum + (p.free_spots || 0), 0);

  const mobileStyle = isMobile && bottomSheet
    ? {
        transform: `translateY(${bottomSheet.translateY}px)`,
        transition: bottomSheet.isAnimating ? "transform 300ms ease-out" : "none",
        height: "100vh",
        top: 0,
      }
    : undefined;

  return (
    <aside
      className={`sidebar${collapsed ? " collapsed" : ""}${isMobile ? " sidebar-mobile" : ""}`}
      style={mobileStyle}
      {...(isMobile && bottomSheet ? bottomSheet.handlers : {})}
    >
      {!isMobile && (
        <button className="sidebar-collapse-btn" onClick={onToggleCollapse} title={collapsed ? "Espandi sidebar" : "Comprimi sidebar"}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      )}

      {isMobile && <div className="drag-handle" />}

      {collapsed ? (
        <div className="sidebar-collapsed-icons">
          <span className="logo-icon">P</span>
          <span className="collapsed-stat">{availableCount}</span>
          <span className="collapsed-stat-label">aperti</span>
          {weather && (
            <>
              <span className="collapsed-weather-icon">{weather.icon}</span>
              <span className="collapsed-weather-temp">{weather.temperature}°</span>
            </>
          )}
        </div>
      ) : isMobile && bottomSheet?.sheetState === "closed" ? (
        <div className="sheet-collapsed-stats">
          <span>{availableCount} aperti</span>
          <span className="sheet-collapsed-dot">&middot;</span>
          <span>{totalSpots.toLocaleString()} posti liberi</span>
          {weather && (
            <>
              <span className="sheet-collapsed-dot">&middot;</span>
              <span className="sheet-weather">{weather.icon} {weather.temperature}°</span>
            </>
          )}
        </div>
      ) : (
        <>
          <header className="sidebar-header">
            <div className="logo">
              <span className="logo-icon">P</span>
              <div>
                <h1>Torino Parking</h1>
                <p className="subtitle">Disponibilita in tempo reale</p>
              </div>
              {onToggleTheme && (
                <button
                  className="theme-toggle"
                  onClick={onToggleTheme}
                  title={theme === "dark" ? "Tema chiaro" : "Tema scuro"}
                >
                  {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                </button>
              )}
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

                <Filters filters={filters} onChange={onFilterChange} poiLayers={poiLayers} onTogglePOILayer={onTogglePOILayer} />
              </div>

              {filters.nearbyMode && filters.userLat !== null && filters.userLng !== null && (
                <NearestParkingBanner
                  parkings={parkings}
                  userLat={filters.userLat}
                  userLng={filters.userLng}
                  onSelect={onSelect}
                />
              )}

              {selectedPOI && (
                <div className="poi-nearby-section">
                  <div className="poi-nearby-header">
                    <span>Parcheggi vicino a <strong>{selectedPOI.name}</strong></span>
                    <button className="poi-nearby-close" onClick={() => onSelectPOI?.(null)}>&#x2715;</button>
                  </div>
                  {getNearestParkings(selectedPOI, parkings).map((p) => (
                    <div
                      key={p.id}
                      className="poi-nearby-item"
                      onClick={() => onSelect(p)}
                    >
                      <span className="poi-nearby-name">{p.name}</span>
                      <span className="poi-nearby-meta">
                        {p.free_spots} posti &middot; {formatDistance(p.distance)}
                      </span>
                    </div>
                  ))}
                </div>
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
        </>
      )}
    </aside>
  );
}
