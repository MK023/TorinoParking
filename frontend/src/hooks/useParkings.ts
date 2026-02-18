import { useCallback, useEffect, useRef, useState } from "react";
import type { Parking, ParkingListResponse } from "../types/parking";
import { getNearbyParkings, getParkings } from "../services/api";

const REFRESH_NORMAL = 120_000;          // 2 minutes
const REFRESH_NEARBY = 30_000;           // 30 seconds
const NEARBY_BOOST_DURATION = 300_000;   // 5 minutes

export interface Filters {
  onlyAvailable: boolean;
  minSpots: number;
  nearbyMode: boolean;
  userLat: number | null;
  userLng: number | null;
  radius: number;
  disabledSpots: boolean;
  electronicPayment: boolean;
  covered: boolean;
  metroAccess: boolean;
}

const ELECTRONIC_KEYWORDS = [
  "carte", "visa", "mastercard", "bancomat", "telepass",
  "carta", "pos", "contactless",
];

function matchesClientFilters(p: Parking, f: Filters): boolean {
  if (f.onlyAvailable && !p.is_available) return false;
  if (f.minSpots > 0 && (p.free_spots === null || p.free_spots < f.minSpots))
    return false;
  if (f.disabledSpots) {
    if (!p.detail || !p.detail.disabled_spots || p.detail.disabled_spots <= 0)
      return false;
  }
  if (f.electronicPayment) {
    if (!p.detail || p.detail.payment_methods.length === 0) return false;
    const methods = p.detail.payment_methods
      .join(" ")
      .toLowerCase();
    if (!ELECTRONIC_KEYWORDS.some((kw) => methods.includes(kw))) return false;
  }
  if (f.covered) {
    if (!p.detail || !p.detail.is_covered) return false;
  }
  if (f.metroAccess) {
    if (!p.detail || !p.detail.has_metro_access) return false;
  }
  return true;
}

export function useParkings() {
  const [allParkings, setAllParkings] = useState<Parking[]>([]);
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
    disabledSpots: false,
    electronicPayment: false,
    covered: false,
    metroAccess: false,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const boostTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nearbyBoostUntil = useRef(0);

  const getRefreshInterval = useCallback(() => {
    if (Date.now() < nearbyBoostUntil.current) return REFRESH_NEARBY;
    return REFRESH_NORMAL;
  }, []);

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
        data = await getParkings();
      }

      setAllParkings(data.parkings);
      setLastUpdate(data.last_update);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore di connessione");
    } finally {
      setLoading(false);
    }
  }, [filters.nearbyMode, filters.userLat, filters.userLng, filters.radius]);

  const boostRefresh = useCallback(() => {
    nearbyBoostUntil.current = Date.now() + NEARBY_BOOST_DURATION;
    clearInterval(intervalRef.current);
    clearTimeout(boostTimeoutRef.current);
    intervalRef.current = setInterval(fetchData, REFRESH_NEARBY);
    boostTimeoutRef.current = setTimeout(() => {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(fetchData, REFRESH_NORMAL);
    }, NEARBY_BOOST_DURATION);
  }, [fetchData]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    intervalRef.current = setInterval(fetchData, getRefreshInterval());

    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(intervalRef.current);
      } else {
        fetchData();
        intervalRef.current = setInterval(fetchData, getRefreshInterval());
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(boostTimeoutRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchData, getRefreshInterval]);

  const parkings = allParkings.filter((p) => matchesClientFilters(p, filters));

  return {
    parkings,
    allParkings,
    lastUpdate,
    loading,
    error,
    filters,
    setFilters,
    refresh: fetchData,
    boostRefresh,
  };
}
