export type LatLng = [number, number];

export type Waypoint = {
  lat: number;
  lng: number;
  name: string;
  distance_m: number;
  score: number;
  voice: string;
  nearest_idx: number;
  tags?: string[];
  junction_type?: string;
};

export type NavigationStep = {
  instruction: string;
  distance_m: number;
  duration_s: number;
  name: string;
  maneuver_type: string;
  modifier: string;
  icon: string;
  location: LatLng;
  polyline: LatLng[];
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
  steps?: NavigationStep[];
  recommended?: boolean;
  safety_score?: number;
  police_nearby?: number;
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

export type EmergencyService = {
  name: string;
  type: "hospital" | "police" | "fire";
  lat: number;
  lng: number;
  phone: string;
  distance_m: number;
  distance_km: number;
};

export type EmergencyAlert = {
  status: string;
  message: string;
  location: { lat: number; lng: number };
  type: string;
  timestamp: string;
  notified: {
    service: string;
    type: string;
    phone: string;
    distance_km: number;
  }[];
};

export type LiveWeather = {
  category: Weather;
  label: string;
  wmo_code: number;
  temperature_c: number | null;
  humidity_pct: number | null;
  wind_kmh: number | null;
  visibility_m: number | null;
  source: string;
};

export type SafeZone = {
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  reasons: string[];
};

export type AreaRiskCell = {
  lat: number;
  lng: number;
  score: number;
  level: "low" | "medium" | "high";
  spots_nearby: number;
};

export type CommunityReport = {
  id: number;
  lat: number;
  lng: number;
  type: string;
  description: string;
  severity: number;
  timestamp: string;
  upvotes: number;
};

export type RouteMode = "fastest" | "balanced" | "safest";

export type TripMemory = {
  from: string;
  to: string;
  weather: Weather;
  hour: number;
  risk: number;
  hazards: number;
  timestamp: string;
  routeId: string;
};

export type RiskExplanation = {
  name: string;
  score: number;
  junction_type: string;
  tags: string[];
  base_risk: number;
  contributing_factors: string[];
  safety_advice: string[];
  voice: string;
  lat: number;
  lng: number;
};

export type TripSession = {
  share_id: string;
  trip_id: string;
  from: string;
  to: string;
  driver: string;
  weather: string;
  risk: number;
  started_at: string;
  last_update: string;
  position: { lat: number; lng: number } | null;
  pct: number;
  status: string;
  polyline: LatLng[];
};

export type SmartNotification = {
  should_notify: boolean;
  current_risk: number;
  baseline_risk: number;
  risk_increase: number;
  pct_increase: number;
  best_slot: WindowSlot | null;
  best_saving_pct: number;
  message: string;
};

export type DriverScore = {
  total_trips: number;
  safe_trips: number;
  hazards_avoided: number;
  avg_risk: number;
  streak_days: number;
  score: number;
  percentile: number;
  last_updated: string;
};
