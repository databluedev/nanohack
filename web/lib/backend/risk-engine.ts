/**
 * SafeWindow risk engine.
 * Pure TypeScript, no external deps. Computes per-route risk based on:
 *   - Proximity of route polyline to known black spots
 *   - Time-of-day, weather, day-type multipliers
 *   - Conditional spike multipliers per black spot
 */

import { CHENNAI_BLACKSPOTS, type Blackspot } from "./blackspots";
import { getRouteCongestion } from "./traffic";

export type Polyline = [number, number][];

const EARTH_R = 6371000.0; // meters

export function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const p1 = (aLat * Math.PI) / 180;
  const p2 = (bLat * Math.PI) / 180;
  const dp = ((bLat - aLat) * Math.PI) / 180;
  const dl = ((bLng - aLng) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

export function timeWindow(hour: number): string {
  if (hour >= 6 && hour < 10) return "morning";
  if (hour >= 10 && hour < 16) return "midday";
  if (hour >= 16 && hour < 20) return "evening";
  if (hour >= 20 && hour < 24) return "night";
  return "latenight";
}

export function timeMultiplier(window: string): number {
  const map: Record<string, number> = {
    morning: 1.3,
    midday: 0.9,
    evening: 1.5,
    night: 1.4,
    latenight: 1.1,
  };
  return map[window] ?? 1.0;
}

export function weatherMultiplier(weather: string): number {
  const map: Record<string, number> = {
    clear: 1.0,
    cloudy: 1.05,
    rain: 1.6,
    heavy_rain: 1.9,
    fog: 1.7,
  };
  return map[weather] ?? 1.0;
}

export function dayMultiplier(dayType: string): number {
  const map: Record<string, number> = {
    weekday: 1.0,
    weekend: 1.15,
    holiday: 1.2,
    festival: 1.3,
  };
  return map[dayType] ?? 1.0;
}

export function classifyDay(dt: Date): string {
  const day = dt.getDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6 ? "weekend" : "weekday";
}

// ---- Spot risk along a route ----

export interface SpotHit {
  spot: Blackspot;
  distance_m: number;
  nearest_idx: number;
}

export function findNearbySpots(polyline: Polyline, radiusM: number = 600.0): SpotHit[] {
  const hits: SpotHit[] = [];
  for (const spot of CHENNAI_BLACKSPOTS) {
    let minD = Infinity;
    let nearestIdx = 0;
    for (let i = 0; i < polyline.length; i++) {
      const [lat, lng] = polyline[i];
      const d = haversineM(lat, lng, spot.lat, spot.lng);
      if (d < minD) {
        minD = d;
        nearestIdx = i;
      }
    }
    if (minD <= radiusM) {
      hits.push({
        spot,
        distance_m: Math.round(minD * 10) / 10,
        nearest_idx: nearestIdx,
      });
    }
  }
  return hits;
}

export function conditionalSpike(
  spot: Blackspot,
  window: string,
  weather: string,
  dayType: string,
): number {
  const spikes = spot.spikes;
  let mult = 1.0;
  if (window in spikes) mult *= spikes[window];
  if ((weather === "rain" || weather === "heavy_rain") && "rain" in spikes) mult *= spikes.rain;
  if ((dayType === "weekend" || dayType === "holiday" || dayType === "festival") && "weekend" in spikes) mult *= spikes.weekend;
  return mult;
}

export interface RouteWaypoint {
  lat: number;
  lng: number;
  name: string;
  distance_m: number;
  score: number;
  voice: string;
  nearest_idx: number;
  tags: string[];
  junction_type: string;
}

export interface RouteAssessment {
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
  waypoints: RouteWaypoint[];
}

export function assessRoute(
  polyline: Polyline,
  departure: Date,
  weather: string = "clear",
): RouteAssessment {
  const window = timeWindow(departure.getHours());
  const dayType = classifyDay(departure);

  const baseMult = timeMultiplier(window) * weatherMultiplier(weather) * dayMultiplier(dayType);

  const hits = findNearbySpots(polyline);

  const waypoints: RouteWaypoint[] = [];
  let spotRiskSum = 0.0;
  for (const h of hits) {
    const spot = h.spot;
    // Risk decays with distance from route (closer = higher exposure)
    const proximityFactor = Math.max(0.3, 1.0 - h.distance_m / 600.0);
    const spike = conditionalSpike(spot, window, weather, dayType);
    const score = (spot.base * proximityFactor * baseMult * spike) / 100.0; // normalize roughly
    spotRiskSum += score;
    waypoints.push({
      lat: spot.lat,
      lng: spot.lng,
      name: spot.name,
      distance_m: h.distance_m,
      score: Math.round(score * 100) / 100,
      voice: spot.voice,
      nearest_idx: h.nearest_idx,
      tags: spot.tags || [],
      junction_type: spot.junction_type || "unknown",
    });
  }

  // Traffic congestion factor
  let trafficMult = 1.0;
  try {
    const isWknd = dayType === "weekend" || dayType === "holiday" || dayType === "festival";
    const congestion = getRouteCongestion(polyline, departure.getHours(), isWknd);
    trafficMult = congestion.risk_multiplier ?? 1.0;
  } catch {
    trafficMult = 1.0;
  }

  // Background risk per km (structural baseline)
  const lengthKm = polylineLengthKm(polyline);
  const background = lengthKm * 0.25 * baseMult; // ~0.25 risk per km in clear weekday midday

  const total = (spotRiskSum + background) * trafficMult;
  // Soft saturation: avoid hard 100 cap so time-slider shows variation
  // logistic-ish: 100 * total / (total + K)
  const K = 30.0;
  const totalNorm = (100.0 * total) / (total + K);

  waypoints.sort((a, b) => b.score - a.score);

  return {
    total_risk: Math.round(totalNorm * 10) / 10,
    background_risk: Math.round(((100.0 * background) / (background + K)) * 10) / 10,
    spot_risk: Math.round(((100.0 * spotRiskSum) / (spotRiskSum + K)) * 10) / 10,
    length_km: Math.round(lengthKm * 100) / 100,
    context: {
      time_window: window,
      day_type: dayType,
      weather,
      departure: departure.toISOString(),
    },
    waypoints,
  };
}

export function polylineLengthKm(poly: Polyline): number {
  if (poly.length < 2) return 0.0;
  let total = 0.0;
  for (let i = 1; i < poly.length; i++) {
    total += haversineM(poly[i - 1][0], poly[i - 1][1], poly[i][0], poly[i][1]);
  }
  return total / 1000.0;
}

export interface SegmentRisk {
  polyline: Polyline;
  score: number;
  level: string;
}

export function segmentRisks(polyline: Polyline, waypoints: RouteWaypoint[]): SegmentRisk[] {
  const n = polyline.length;
  if (n < 2) return [];
  const segCount = Math.min(40, Math.max(8, Math.floor(n / 5)));
  const chunk = Math.max(1, Math.floor(n / segCount));
  const segments: SegmentRisk[] = [];

  for (let s = 0; s < n - 1; s += chunk) {
    const e = Math.min(n - 1, s + chunk);
    const segPts = polyline.slice(s, e + 1);
    // Find max risk among waypoints whose nearest_idx falls in this range or close
    let maxScore = 0.0;
    for (const w of waypoints) {
      if (w.nearest_idx >= s - chunk && w.nearest_idx <= e + chunk) {
        maxScore = Math.max(maxScore, w.score);
      }
    }
    segments.push({
      polyline: segPts,
      score: Math.round(maxScore * 100) / 100,
      level: riskLevel(maxScore),
    });
  }
  return segments;
}

export function riskLevel(score: number): string {
  if (score >= 5.0) return "high";
  if (score >= 1.5) return "medium";
  return "low";
}

export interface RiskWindowSlot {
  time: string;
  label: string;
  risk: number;
  weather: string;
}

export function riskWindow(
  polyline: Polyline,
  baseDt: Date,
  weatherNow: string,
  horizonHours: number = 6,
  stepMin: number = 30,
): RiskWindowSlot[] {
  const slots: RiskWindowSlot[] = [];
  const steps = Math.floor((horizonHours * 60) / stepMin);

  for (let i = 0; i <= steps; i++) {
    const dt = new Date(baseDt.getTime() + i * stepMin * 60 * 1000);
    // Naively assume weather persists for next 2h, then clears
    const w = i * stepMin < 120 ? weatherNow : "clear";
    const a = assessRoute(polyline, dt, w);

    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");

    slots.push({
      time: dt.toISOString(),
      label: `${hh}:${mm}`,
      risk: a.total_risk,
      weather: w,
    });
  }
  return slots;
}
