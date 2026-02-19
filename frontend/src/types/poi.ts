export type POICategory = "hospital" | "university";

export interface POI {
  id: string;
  name: string;
  category: POICategory;
  lat: number;
  lng: number;
  address: string;
}
