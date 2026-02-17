import type { Parking } from "../types/parking";

export function getStatusColor(parking: Parking): string {
  if (!parking.is_available) return "#6b7280";
  if (parking.occupancy_percentage === null) return "#6b7280";
  if (parking.occupancy_percentage >= 90) return "#ef4444";
  if (parking.occupancy_percentage >= 70) return "#f59e0b";
  return "#22c55e";
}

export function getTendenceInfo(tendence: number | null): {
  icon: string;
  text: string;
} {
  if (tendence === null) return { icon: "", text: "" };
  if (tendence > 0) return { icon: "\u2191", text: "si libera" };
  if (tendence < 0) return { icon: "\u2193", text: "si riempie" };
  return { icon: "\u2192", text: "stabile" };
}

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function getNavigationUrl(lat: number, lng: number): string {
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) {
    return `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}
