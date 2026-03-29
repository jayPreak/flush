export type ToiletType = "public" | "restaurant" | "mall" | "gas_station" | "hotel";

export type ToiletStatus = "active" | "closed" | "flagged";

export type AmenityType =
  | "western"
  | "squat"
  | "japanese"
  | "bidet"
  | "spray_jet"
  | "urinal_only"
  | "soap"
  | "tissue"
  | "hand_dryer"
  | "luggage_space"
  | "wheelchair"
  | "baby_changing";

export interface Toilet {
  id: string;
  lat: number;
  lng: number;
  name: string | null;
  description: string | null;
  type: ToiletType;
  is_free: boolean;
  price_inr: number | null;
  opening_hours: string | null;
  status: ToiletStatus;
  avg_rating: number;
  review_count: number;
  osm_id: number | null;
  created_at: string;
  updated_at: string;
  amenities: AmenityType[];
  distance_m?: number;
}

export interface Review {
  id: string;
  toilet_id: string;
  rating: number;
  body: string | null;
  created_at: string;
}

export interface NearbyToiletParams {
  lat: number;
  lng: number;
  radius_m?: number;
}
