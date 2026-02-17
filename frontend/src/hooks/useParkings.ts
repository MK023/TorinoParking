import { useCallback, useEffect, useRef, useState } from "react";
import type { Parking, ParkingListResponse } from "../types/parking";
import { getNearbyParkings, getParkings } from "../services/api";

const REFRESH_INTERVAL = 120_000; // 2 minutes

interface Filters {
  onlyAvailable: boolean;
  minSpots: number;
  nearbyMode: boolean;
  userLat: number | null;
  userLng: number | null;
  radius: number;
}

export function useParkings() {
  const [parkings, setParkings] = useState<Parking[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    onlyAvailable: false,
    minSpots: 0,
    nearbyMode: false,
    userLat: null,
    userLng: null,
    radius: 1500,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      let data: ParkingListResponse;

      if (filters.nearbyMode && filters.userLat !== null && filters.userLng !== null) {
        data = await getNearbyParkings(
          filters.userLat,
          filters.userLng,
          filters.radius,
          50
        );
      } else {
        data = await getParkings({
          available: filters.onlyAvailable ? true : undefined,
          min_spots: filters.minSpots > 0 ? filters.minSpots : undefined,
        });
      }

      setParkings(data.parkings);
      setLastUpdate(data.last_update);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore di connessione");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    setLoading(true);
    fetchData();

    intervalRef.current = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [fetchData]);

  return {
    parkings,
    lastUpdate,
    loading,
    error,
    filters,
    setFilters,
    refresh: fetchData,
  };
}
