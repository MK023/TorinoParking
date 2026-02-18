import { useCallback, useEffect, useState } from "react";
import type { Parking } from "./types/parking";
import type { POI, POICategory } from "./types/poi";
import { poiData } from "./data/poi";
import { useParkings } from "./hooks/useParkings";
import { useBottomSheet } from "./hooks/useBottomSheet";
import { useTheme } from "./hooks/useTheme";
import { useWeather } from "./hooks/useWeather";
import ParkingMap from "./components/ParkingMap";
import Sidebar from "./components/Sidebar";
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
  const [selectedParking, setSelectedParking] = useState<Parking | null>(null);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [poiLayers, setPoiLayers] = useState<Set<POICategory>>(new Set());
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);

  const isMobile = useIsMobile();
  const bottomSheet = useBottomSheet();
  const { theme, toggleTheme } = useTheme();
  const weather = useWeather();

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

  useEffect(() => {
    if (!isMobile) return;
    if (selectedParking) {
      bottomSheet.setSheetState("full");
    } else {
      bottomSheet.setSheetState("half");
    }
  }, [selectedParking, isMobile]);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
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
      },
      () => {
        alert("Impossibile ottenere la posizione. Controlla i permessi.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [setFilters, boostRefresh]);

  const handleSelect = useCallback((parking: Parking | null) => {
    setSelectedParking(parking);
  }, []);

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
    if (poi) setSelectedParking(null);
  }, []);

  const handleMapClick = useCallback(() => {
    if (isMobile) {
      bottomSheet.setSheetState("closed");
    }
  }, [isMobile, bottomSheet]);

  return (
    <div className="app-layout">
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
        bottomSheet={isMobile ? bottomSheet : undefined}
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
