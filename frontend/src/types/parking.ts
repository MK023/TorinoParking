export interface ParkingDetail {
  address: string;
  district: string;
  operator: string;
  floors: number | null;
  disabled_spots: number | null;
  is_covered: boolean;
  is_custodied: boolean;
  open_24h: boolean;
  hourly_rate_daytime: number | null;
  hourly_rate_nighttime: number | null;
  daily_rate: number | null;
  monthly_subscription: number | null;
  bus_lines: string[];
  has_metro_access: boolean;
  payment_methods: string[];
  cameras: number | null;
  notes: string;
}

export interface Parking {
  id: number;
  name: string;
  status: number;
  total_spots: number;
  free_spots: number | null;
  tendence: number | null;
  lat: number;
  lng: number;
  status_label: string;
  is_available: boolean;
  occupancy_percentage: number | null;
  detail: ParkingDetail | null;
}

export interface ParkingListResponse {
  total: number;
  last_update: string;
  source: string;
  parkings: Parking[];
}

export interface Snapshot {
  free_spots: number | null;
  total_spots: number;
  status: number;
  tendence: number | null;
  recorded_at: string;
}

export interface ParkingHistoryResponse {
  parking_id: number;
  hours: number;
  total_snapshots: number;
  snapshots: Snapshot[];
}
