import type {
  LatLng, Route, Weather, WindowResult,
  EmergencyService, EmergencyAlert, LiveWeather,
  SafeZone, AreaRiskCell, CommunityReport,
  RiskExplanation, TripSession, SmartNotification, Waypoint,
} from "./types";

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return (await r.json()) as T;
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return (await r.json()) as T;
}

// ---- Core routing ----
export async function fetchRoutes(opts: {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  departure: string;
  weather: Weather;
}): Promise<{ routes: Route[]; count: number }> {
  return post("/api/route", {
    from_lat: opts.from.lat, from_lng: opts.from.lng,
    to_lat: opts.to.lat, to_lng: opts.to.lng,
    departure: opts.departure, weather: opts.weather, alternatives: 2,
  });
}

export async function fetchSafeRoutes(opts: {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  departure: string;
  weather: Weather;
}): Promise<{ routes: Route[]; count: number; mode: string }> {
  return post("/api/route/safe", {
    from_lat: opts.from.lat, from_lng: opts.from.lng,
    to_lat: opts.to.lat, to_lng: opts.to.lng,
    departure: opts.departure, weather: opts.weather, alternatives: 2,
  });
}

export async function fetchWindow(opts: {
  polyline: LatLng[]; weather: Weather; base: string;
}): Promise<WindowResult> {
  return post("/api/window", {
    polyline: opts.polyline, weather: opts.weather,
    base: opts.base, horizon_hours: 6, step_min: 30,
  });
}

// ---- Emergency ----
export async function fetchEmergencyNearby(opts: {
  lat: number; lng: number; radius_m?: number; service_type?: string;
}): Promise<{ services: EmergencyService[]; count: number }> {
  return post("/api/emergency/nearby", {
    lat: opts.lat, lng: opts.lng,
    radius_m: opts.radius_m ?? 5000, service_type: opts.service_type ?? null,
  });
}

export async function sendEmergencyAlert(opts: {
  lat: number; lng: number; user_name?: string; alert_type?: string;
}): Promise<EmergencyAlert> {
  return post("/api/emergency/alert", {
    lat: opts.lat, lng: opts.lng,
    user_name: opts.user_name ?? "Driver", alert_type: opts.alert_type ?? "accident",
  });
}

// ---- Weather ----
export async function fetchLiveWeather(lat = 13.05, lng = 80.22): Promise<LiveWeather> {
  return post("/api/weather", { lat, lng });
}
export async function fetchChennaiWeather(): Promise<LiveWeather> {
  return get("/api/weather/chennai");
}

// ---- Overlays ----
export async function fetchSafeZones(): Promise<{ zones: SafeZone[]; count: number }> {
  return get("/api/safezones");
}
export async function fetchAreaRisk(opts?: {
  lat?: number; lng?: number; radius_km?: number;
}): Promise<{ cells: AreaRiskCell[]; grid_size: number }> {
  return post("/api/area-risk", { lat: opts?.lat ?? 13.05, lng: opts?.lng ?? 80.22, radius_km: opts?.radius_km ?? 8.0 });
}

// ---- Community ----
export async function fetchCommunityReports(): Promise<{ reports: CommunityReport[] }> {
  return get("/api/community/reports");
}
export async function submitCommunityReport(opts: {
  lat: number; lng: number; report_type: string; description?: string; severity?: number;
}): Promise<CommunityReport> {
  return post("/api/community/report", {
    lat: opts.lat, lng: opts.lng, report_type: opts.report_type,
    description: opts.description ?? "", severity: opts.severity ?? 2,
  });
}

// ---- Risk Explainer ----
export async function fetchRiskExplanation(opts: {
  polyline: LatLng[]; departure: string; weather: Weather;
}): Promise<{ explanations: RiskExplanation[]; context: Record<string, string>; total_risk: number }> {
  return post("/api/risk/explain", { polyline: opts.polyline, departure: opts.departure, weather: opts.weather });
}

// ---- Trip Sessions (Family Safety) ----
export async function startTripSession(opts: {
  trip_id: string; from_name: string; to_name: string;
  polyline: LatLng[]; weather: string; risk: number; driver_name?: string;
}): Promise<{ share_id: string; share_url: string }> {
  return post("/api/trip/start", opts);
}

export async function updateTripSession(opts: {
  trip_id: string; lat: number; lng: number; risk: number; pct: number; status: string;
}): Promise<{ ok: boolean }> {
  return post("/api/trip/update", opts);
}

export async function fetchFamilyTrip(share_id: string): Promise<TripSession> {
  return get(`/api/trip/family/${share_id}`);
}

// ---- Smart Notifications ----
export async function fetchSmartNotification(opts: {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  departure: string;
  weather: Weather;
}): Promise<SmartNotification> {
  return post("/api/smart-notify", {
    from_lat: opts.from.lat, from_lng: opts.from.lng,
    to_lat: opts.to.lat, to_lng: opts.to.lng,
    departure: opts.departure, weather: opts.weather,
  });
}

// ---- Reassessment (weather re-routing) ----
export async function fetchReassessment(opts: {
  polyline: LatLng[]; departure: string; weather: Weather;
}): Promise<{ assessment: { total_risk: number; waypoints: Waypoint[] }; segments: unknown[] }> {
  return post("/api/assess", { polyline: opts.polyline, departure: opts.departure, weather: opts.weather });
}
