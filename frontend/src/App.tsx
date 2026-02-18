import { useCallback, useEffect, useState } from "react";
import type { Parking } from "./types/parking";
import { useParkings } from "./hooks/useParkings";
import { useBottomSheet } from "./hooks/useBottomSheet";
import ParkingMap from "./components/ParkingMap";
import Sidebar from "./components/Sidebar";
import "./styles/app.css";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
}

export default function App() {
  const { parkings, allParkings, lastUpdate, loading, error, filters, setFilters, refresh } =
    useParkings();
  const [selectedParking, setSelectedParking] = useState<Parking | null>(null);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);

  const isMobile = useIsMobile();
  const bottomSheet = useBottomSheet();

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
      },
      () => {
        alert("Impossibile ottenere la posizione. Controlla i permessi.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [setFilters]);

  const handleSelect = useCallback((parking: Parking | null) => {
    setSelectedParking(parking);
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
      />
      <ParkingMap
        parkings={parkings}
        selectedId={selectedParking?.id ?? null}
        onSelect={(p) => handleSelect(p)}
        userPosition={userPosition}
        onMapClick={handleMapClick}
      />
    </div>
  );
}
