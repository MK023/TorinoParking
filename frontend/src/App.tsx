import { useCallback, useState } from "react";
import type { Parking } from "./types/parking";
import { useParkings } from "./hooks/useParkings";
import ParkingMap from "./components/ParkingMap";
import Sidebar from "./components/Sidebar";
import "./styles/app.css";

export default function App() {
  const { parkings, allParkings, lastUpdate, loading, error, filters, setFilters, refresh } =
    useParkings();
  const [selectedParking, setSelectedParking] = useState<Parking | null>(null);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);

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
      />
      <ParkingMap
        parkings={parkings}
        selectedId={selectedParking?.id ?? null}
        onSelect={(p) => handleSelect(p)}
        userPosition={userPosition}
      />
    </div>
  );
}
