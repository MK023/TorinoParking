import type { ParkingListResponse, ParkingHistoryResponse } from "../types/parking";

const API_BASE = import.meta.env.VITE_API_URL || "";

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getParkings(params?: {
  available?: boolean;
  min_spots?: number;
}): Promise<ParkingListResponse> {
  const query = new URLSearchParams();
  if (params?.available !== undefined) query.set("available", String(params.available));
  if (params?.min_spots !== undefined) query.set("min_spots", String(params.min_spots));
  const qs = query.toString();
  return fetchJSON(`${API_BASE}/api/v1/parkings${qs ? `?${qs}` : ""}`);
}

export async function getNearbyParkings(
  lat: number,
  lng: number,
  radius = 1500,
  limit = 20
): Promise<ParkingListResponse> {
  return fetchJSON(
    `${API_BASE}/api/v1/parkings/nearby?lat=${lat}&lng=${lng}&radius=${radius}&limit=${limit}`
  );
}

export async function getParkingHistory(
  parkingId: number,
  hours = 24
): Promise<ParkingHistoryResponse> {
  return fetchJSON(
    `${API_BASE}/api/v1/parkings/${parkingId}/history?hours=${hours}`
  );
}
