import { useCallback, useRef, useState } from "react";
import type { Parking } from "../types/parking";
import type { POI, POICategory } from "../types/poi";
import type { Filters as FilterState } from "../hooks/useParkings";
import ParkingCard from "./ParkingCard";
import ParkingDetail from "./ParkingDetail";
import Filters from "./Filters";
import NearestParkingBanner from "./NearestParkingBanner";
import { getNearestParkings } from "./POILayer";
import { formatDistance } from "../utils/parking";
import type { Theme } from "../hooks/useTheme";
import type { Weather } from "../hooks/useWeather";
import { Search, LocateArrow, Refresh, ChevronLeft, ChevronRight, Sun, Moon } from "./Icons";

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
  mobileOverlayOpen?: boolean;
  onMobileOverlayChange?: (open: boolean) => void;
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
  mobileOverlayOpen,
  onMobileOverlayChange,
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

  // Drag-to-open on mobile bar
  const dragStartY = useRef<number | null>(null);
  const barHandlers = {
    onTouchStart: (e: React.TouchEvent) => {
      dragStartY.current = e.touches[0].clientY;
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (dragStartY.current === null) return;
      const delta = dragStartY.current - e.touches[0].clientY;
      if (delta > 40) {
        dragStartY.current = null;
        onMobileOverlayChange?.(true);
      }
    },
    onTouchEnd: () => {
      dragStartY.current = null;
    },
  };

  // Swipe-down to dismiss detail (iOS style)
  const [swipeY, setSwipeY] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const swipeStartY = useRef<number | null>(null);
  const swipeStartScroll = useRef(0);
  const overlayBodyRef = useRef<HTMLDivElement | null>(null);

  const onDetailTouchStart = useCallback((e: React.TouchEvent) => {
    swipeStartY.current = e.touches[0].clientY;
    swipeStartScroll.current = overlayBodyRef.current?.scrollTop ?? 0;
  }, []);

  const onDetailTouchMove = useCallback((e: React.TouchEvent) => {
    if (swipeStartY.current === null) return;
    const scrollTop = overlayBodyRef.current?.scrollTop ?? 0;
    // Only start swipe if scrolled to top
    if (scrollTop > 0) {
      swipeStartY.current = null;
      return;
    }
    const delta = e.touches[0].clientY - swipeStartY.current;
    if (delta > 0) {
      // Swiping down - apply resistance
      const dampened = Math.pow(delta, 0.75);
      setSwipeY(dampened);
      setSwiping(true);
    }
  }, []);

  const onDetailTouchEnd = useCallback(() => {
    if (swipeY > 120) {
      // Dismiss
      setSwipeY(window.innerHeight);
      setTimeout(() => {
        onSelect(null);
        setSwipeY(0);
        setSwiping(false);
      }, 250);
    } else {
      // Spring back
      setSwipeY(0);
      setSwiping(false);
    }
    swipeStartY.current = null;
  }, [swipeY, onSelect]);

  const listAndControls = (
    <>
      <div className="sidebar-controls">
        <div className="search-box">
          <Search />
          <input
            type="text"
            placeholder="Cerca parcheggio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </div>

        <div className="action-buttons">
          <button className="btn btn-locate" onClick={onLocateMe} title="La mia posizione">
            <LocateArrow size={14} />
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
  );

  // ===== MOBILE =====
  if (isMobile) {
    return (
      <>
        {/* Fixed bottom bar - always visible when overlay closed */}
        {!mobileOverlayOpen && (
          <div
            className="mobile-bar"
            onClick={() => onMobileOverlayChange?.(true)}
            {...barHandlers}
          >
            <div className="mobile-bar-pill" />
            <div className="mobile-bar-stats">
              <span className="mobile-bar-value">{availableCount}</span>
              <span className="mobile-bar-label">aperti</span>
              <span className="mobile-bar-dot">&middot;</span>
              <span className="mobile-bar-value">{totalSpots.toLocaleString()}</span>
              <span className="mobile-bar-label">posti liberi</span>
              {weather && (
                <>
                  <span className="mobile-bar-dot">&middot;</span>
                  <span className="mobile-bar-weather">{weather.icon} {weather.temperature}°</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Full-screen overlay */}
        <div className={`mobile-overlay${mobileOverlayOpen ? " open" : ""}`}>
          <header className="mobile-overlay-header">
            <div className="mobile-overlay-top">
              <div className="mobile-overlay-title">
                <span className="logo-icon">P</span>
                <h1>Torino Parking</h1>
              </div>
              <div className="mobile-overlay-actions">
                {onToggleTheme && (
                  <button
                    className="theme-toggle"
                    onClick={onToggleTheme}
                    title={theme === "dark" ? "Tema chiaro" : "Tema scuro"}
                  >
                    {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                  </button>
                )}
                <button
                  className="mobile-close-btn"
                  onClick={() => {
                    onMobileOverlayChange?.(false);
                    onSelect(null);
                  }}
                >
                  Chiudi
                </button>
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
            {weather && (
              <div className="weather-bar">
                <span className="weather-icon">{weather.icon}</span>
                <span className="weather-temp">{weather.temperature}°C</span>
                <span className="weather-label">{weather.label}</span>
                <span className="weather-city">Torino</span>
              </div>
            )}
          </header>

          <div className="mobile-overlay-body" ref={overlayBodyRef}>
            {selectedParking ? (
              <div
                className="mobile-detail-swipe"
                style={{
                  transform: swipeY > 0 ? `translateY(${swipeY}px)` : undefined,
                  transition: swiping ? "none" : "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
                }}
                onTouchStart={onDetailTouchStart}
                onTouchMove={onDetailTouchMove}
                onTouchEnd={onDetailTouchEnd}
              >
                <div className="mobile-detail-pill" />
                <ParkingDetail parking={selectedParking} onBack={() => onSelect(null)} />
              </div>
            ) : (
              listAndControls
            )}
          </div>

          <footer className="sidebar-footer">
            {lastUpdate && (
              <span>
                Aggiornato: {new Date(lastUpdate).toLocaleTimeString("it-IT")}
              </span>
            )}
            <span>Dati: 5T Torino Open Data</span>
          </footer>
        </div>
      </>
    );
  }

  // ===== DESKTOP =====
  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <button className="sidebar-collapse-btn" onClick={onToggleCollapse} title={collapsed ? "Espandi sidebar" : "Comprimi sidebar"}>
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

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
      ) : (
        <>
          <header className="sidebar-header">
            <div className="logo">
              <span className="logo-icon">P</span>
              <div>
                <h1>Torino Parking</h1>
                <p className="subtitle">Disponibilità in tempo reale</p>
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
            {weather && (
              <div className="weather-bar">
                <span className="weather-icon">{weather.icon}</span>
                <span className="weather-temp">{weather.temperature}°C</span>
                <span className="weather-label">{weather.label}</span>
                <span className="weather-city">Torino</span>
              </div>
            )}
          </header>

          {selectedParking ? (
            <ParkingDetail parking={selectedParking} onBack={() => onSelect(null)} />
          ) : (
            listAndControls
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
