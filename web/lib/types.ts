export type LatLng = [number, number];

export type Waypoint = {
  lat: number;
  lng: number;
  name: string;
  distance_m: number;
  score: number;
  voice: string;
  nearest_idx: number;
};

export type Segment = {
  polyline: LatLng[];
  score: number;
  level: "low" | "medium" | "high";
};

export type Assessment = {
  total_risk: number;
  background_risk: number;
  spot_risk: number;
  length_km: number;
  context: {
    time_window: string;
    day_type: string;
    weather: string;
    departure: string;
  };
  waypoints: Waypoint[];
};

export type Route = {
  id: string;
  polyline: LatLng[];
  distance_m: number;
  duration_s: number;
  source: string;
  assessment: Assessment;
  segments: Segment[];
  recommended?: boolean;
};

export type WindowSlot = {
  time: string;
  label: string;
  risk: number;
  weather: string;
};

export type WindowResult = {
  slots: WindowSlot[];
  best_slot: WindowSlot | null;
  saving_pct: number;
};

export type Weather = "clear" | "cloudy" | "rain" | "heavy_rain" | "fog";
