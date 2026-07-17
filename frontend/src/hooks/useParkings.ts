import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Parking, ParkingListResponse } from "../types/parking";
import { getNearbyParkings, getParkings } from "../services/api";

const REFRESH_NORMAL = 120_000;          // 2 minutes
const REFRESH_NEARBY = 30_000;           // 30 seconds
const NEARBY_BOOST_DURATION = 300_000;   // 5 minutes

export type StatusFilter = "free" | "full" | "outOfService" | "closed" | "fillingUp";

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
  statusFilters: StatusFilter[];
}

const ELECTRONIC_KEYWORDS = [
  "carte", "visa", "mastercard", "bancomat", "telepass",
  "carta", "pos", "contactless",
];

function matchesStatusFilter(p: Parking, sf: StatusFilter): boolean {
  switch (sf) {
    case "free":
      return p.is_available && p.free_spots !== null && p.free_spots > 0 &&
        (p.occupancy_percentage === null || p.occupancy_percentage < 90);
    case "full":
      return p.is_available && (p.free_spots === 0 ||
        (p.occupancy_percentage !== null && p.occupancy_percentage >= 90));
    case "outOfService":
      return !p.is_available && p.status_label === "fuori servizio";
    case "closed":
      return !p.is_available && p.status_label !== "fuori servizio";
    case "fillingUp":
      return p.is_available && p.tendence !== null && p.tendence < 0;
  }
}

function matchesClientFilters(p: Parking, f: Filters): boolean {
  if (f.statusFilters.length > 0) {
    if (!f.statusFilters.some((sf) => matchesStatusFilter(p, sf))) return false;
  }
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
    statusFilters: [],
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const boostTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  // Deadline del boost come stato: al cambio l'effetto sotto ricrea
  // l'interval col ritmo giusto (il vecchio schema a ref+timeout veniva
  // cancellato dal cleanup e il polling restava a 30s per sempre)
  const [boostUntil, setBoostUntil] = useState(0);

  const getRefreshInterval = useCallback(() => {
    if (Date.now() < boostUntil) return REFRESH_NEARBY;
    return REFRESH_NORMAL;
  }, [boostUntil]);

  const fetchData = useCallback(async () => {
    // Un solo fetch in volo: la risposta lenta di una chiamata precedente
    // non deve sovrascrivere quella giusta (interval vs cambio filtri)
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setError(null);
      let data: ParkingListResponse;

      if (filters.nearbyMode && filters.userLat !== null && filters.userLng !== null) {
        data = await getNearbyParkings(
          filters.userLat,
          filters.userLng,
          filters.radius,
          50,
          controller.signal
        );
      } else {
        data = await getParkings(undefined, controller.signal);
      }

      if (controller.signal.aborted) return;
      setAllParkings(data.parkings);
      setLastUpdate(data.last_update);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Errore di connessione");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [filters.nearbyMode, filters.userLat, filters.userLng, filters.radius]);

  const boostRefresh = useCallback(() => {
    setBoostUntil(Date.now() + NEARBY_BOOST_DURATION);
  }, []);

  useEffect(() => {
    // Spinner voluto sia al mount sia quando i filtri nearby rifanno la chiamata (fetchData cambia identità)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetchData();

    const startInterval = () => {
      clearInterval(intervalRef.current);
      if (document.hidden) return;
      intervalRef.current = setInterval(fetchData, getRefreshInterval());
    };
    startInterval();

    // Allo scadere del boost si torna al ritmo normale
    const boostLeft = boostUntil - Date.now();
    if (boostLeft > 0) {
      boostTimeoutRef.current = setTimeout(startInterval, boostLeft);
    }

    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(intervalRef.current);
      } else {
        fetchData();
        startInterval();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(boostTimeoutRef.current);
      abortRef.current?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchData, getRefreshInterval, boostUntil]);

  const parkings = useMemo(
    () => allParkings.filter((p) => matchesClientFilters(p, filters)),
    [allParkings, filters],
  );

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
