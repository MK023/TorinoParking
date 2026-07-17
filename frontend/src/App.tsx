import { useCallback, useEffect, useMemo, useState } from "react";
import type { Parking } from "./types/parking";
import type { POI, POICategory } from "./types/poi";
import { poiData } from "./data/poi";
import { useParkings } from "./hooks/useParkings";
import { useTheme } from "./hooks/useTheme";
import { useWeather } from "./hooks/useWeather";
import ParkingMap from "./components/ParkingMap";
import Sidebar from "./components/Sidebar";
import OfflineBanner from "./components/OfflineBanner";
import { hapticMedium, hapticSelection, hapticNotification, setStatusBarStyle } from "./utils/native";
import "./styles/app.css";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    window.matchMedia("(max-width: 768px)").matches
  );
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export default function App() {
  const { parkings, allParkings, lastUpdate, loading, error, filters, setFilters, refresh, boostRefresh } =
    useParkings();
  const [selected, setSelected] = useState<Parking | null>(null);
  // Riaggancia la selezione ai dati freschi del polling: senza il lookup il
  // pannello dettaglio resterebbe congelato allo snapshot del click mentre
  // mappa e lista si aggiornano. Fallback allo snapshot se il parcheggio
  // esce dal set corrente (es. cambio raggio in nearby mode).
  const selectedParking = useMemo(
    () => (selected ? (allParkings.find((p) => p.id === selected.id) ?? selected) : null),
    [selected, allParkings]
  );
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [poiLayers, setPoiLayers] = useState<Set<POICategory>>(new Set());
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);

  const [mobileOverlayOpen, setMobileOverlayOpen] = useState(false);

  const isMobile = useIsMobile();
  const { theme, toggleTheme } = useTheme();
  const weather = useWeather();

  // Sync status bar style with theme
  useEffect(() => {
    setStatusBarStyle(theme === "dark");
  }, [theme]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("sidebar-collapsed") === "true";
  });

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }, []);

  const handleLocateMe = useCallback(() => {
    hapticMedium();
    if (!navigator.geolocation) {
      hapticNotification("error");
      alert("Geolocalizzazione non supportata dal browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserPosition([lat, lng]);
        setFilters((prev) => ({
          ...prev,
          nearbyMode: true,
          userLat: lat,
          userLng: lng,
        }));
        boostRefresh();
        hapticNotification("success");
      },
      () => {
        hapticNotification("error");
        alert("Impossibile ottenere la posizione. Controlla i permessi.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [setFilters, boostRefresh]);

  const handleSelect = useCallback((parking: Parking | null) => {
    if (parking) hapticSelection();
    setSelected(parking);
    if (parking && isMobile) setMobileOverlayOpen(true);
  }, [isMobile]);

  const togglePOILayer = useCallback((category: POICategory) => {
    setPoiLayers((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
        if (selectedPOI?.category === category) setSelectedPOI(null);
      } else {
        next.add(category);
      }
      return next;
    });
  }, [selectedPOI]);

  const handleSelectPOI = useCallback((poi: POI | null) => {
    setSelectedPOI(poi);
    if (poi) {
      setSelected(null);
      if (isMobile) setMobileOverlayOpen(true);
    }
  }, [isMobile]);

  const handleMapClick = useCallback(() => {
    setSelectedPOI(null);
    if (isMobile) {
      setMobileOverlayOpen(false);
      setSelected(null);
    }
  }, [isMobile]);

  return (
    <div className="app-layout">
      <OfflineBanner />
      <Sidebar
        parkings={parkings}
        allParkings={allParkings}
        loading={loading}
        error={error}
        lastUpdate={lastUpdate}
        selectedParking={selectedParking}
        filters={filters}
        onFilterChange={setFilters}
        onSelect={handleSelect}
        onLocateMe={handleLocateMe}
        onRefresh={refresh}
        isMobile={isMobile}
        mobileOverlayOpen={mobileOverlayOpen}
        onMobileOverlayChange={setMobileOverlayOpen}
        collapsed={!isMobile && sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        poiLayers={poiLayers}
        onTogglePOILayer={togglePOILayer}
        selectedPOI={selectedPOI}
        onSelectPOI={handleSelectPOI}
        theme={theme}
        onToggleTheme={toggleTheme}
        weather={weather}
      />
      <ParkingMap
        parkings={parkings}
        selectedId={selectedParking?.id ?? null}
        onSelect={(p) => handleSelect(p)}
        userPosition={userPosition}
        onMapClick={handleMapClick}
        pois={poiData}
        activePOILayers={poiLayers}
        selectedPOI={selectedPOI}
        onSelectPOI={handleSelectPOI}
        theme={theme}
      />
    </div>
  );
}
