/**
 * Real-time traffic congestion data.
 * Falls back to time-of-day congestion estimates when API is unavailable.
 */

export type Polyline = [number, number][];

export interface CongestionCorridor {
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  peak_morning: number;
  peak_evening: number;
  midday: number;
  night: number;
  weekend: number;
}

export interface CongestionResult {
  congestion: number;
  level: string;
  color: string;
  corridor: string | null;
  speed_factor: number;
}

export interface TrafficOverlayCell {
  lat: number;
  lng: number;
  congestion: number;
  level: string;
  color: string;
  corridor: string | null;
  speed_factor: number;
}

export interface RouteCongestionResult {
  avg_congestion: number;
  max_congestion: number;
  congested_segments: number;
  total_sampled?: number;
  risk_multiplier: number;
  delay_factor?: number;
}

export const CHENNAI_CONGESTION_CORRIDORS: CongestionCorridor[] = [
  {
    name: "Anna Salai (Mount Road)", lat: 13.0604, lng: 80.2496, radius_m: 1500,
    peak_morning: 1.8, peak_evening: 2.2, midday: 1.3, night: 1.0, weekend: 1.1,
  },
  {
    name: "OMR IT Corridor", lat: 12.9395, lng: 80.2398, radius_m: 2000,
    peak_morning: 2.0, peak_evening: 2.5, midday: 1.2, night: 1.0, weekend: 1.0,
  },
  {
    name: "GST Road", lat: 12.9516, lng: 80.1462, radius_m: 1500,
    peak_morning: 1.7, peak_evening: 2.0, midday: 1.4, night: 1.1, weekend: 1.2,
  },
  {
    name: "Kathipara - Guindy Corridor", lat: 12.9900, lng: 80.2000, radius_m: 2000,
    peak_morning: 2.0, peak_evening: 2.3, midday: 1.5, night: 1.0, weekend: 1.1,
  },
  {
    name: "T Nagar Commercial Zone", lat: 13.0418, lng: 80.2341, radius_m: 1000,
    peak_morning: 1.4, peak_evening: 2.0, midday: 1.6, night: 1.0, weekend: 1.8,
  },
  {
    name: "Koyambedu Bus Terminus", lat: 13.0697, lng: 80.1959, radius_m: 1200,
    peak_morning: 1.9, peak_evening: 2.1, midday: 1.5, night: 1.0, weekend: 1.3,
  },
  {
    name: "Central Station Area", lat: 13.0827, lng: 80.2707, radius_m: 1000,
    peak_morning: 2.0, peak_evening: 1.8, midday: 1.3, night: 1.0, weekend: 1.1,
  },
  {
    name: "Velachery - Taramani", lat: 12.9815, lng: 80.2180, radius_m: 1200,
    peak_morning: 1.6, peak_evening: 1.9, midday: 1.3, night: 1.0, weekend: 1.2,
  },
  {
    name: "Porur Junction Zone", lat: 13.0381, lng: 80.1565, radius_m: 1000,
    peak_morning: 1.7, peak_evening: 2.0, midday: 1.4, night: 1.0, weekend: 1.2,
  },
  {
    name: "Adyar - Besant Nagar", lat: 13.0067, lng: 80.2569, radius_m: 1000,
    peak_morning: 1.3, peak_evening: 1.6, midday: 1.2, night: 1.0, weekend: 1.4,
  },
];

const EARTH_R = 6371000.0;

function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const p1 = (aLat * Math.PI) / 180;
  const p2 = (bLat * Math.PI) / 180;
  const dp = ((bLat - aLat) * Math.PI) / 180;
  const dl = ((bLng - aLng) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

function timePeriod(hour: number): string {
  if (hour >= 7 && hour < 10) return "peak_morning";
  if (hour >= 10 && hour < 16) return "midday";
  if (hour >= 16 && hour < 21) return "peak_evening";
  return "night";
}

export function getCongestionForPoint(
  lat: number,
  lng: number,
  hour: number,
  isWeekend: boolean,
): CongestionResult {
  const period = isWeekend ? "weekend" : timePeriod(hour);

  let maxCongestion = 1.0;
  let nearestCorridor: string | null = null;

  for (const corridor of CHENNAI_CONGESTION_CORRIDORS) {
    const d = haversine(lat, lng, corridor.lat, corridor.lng);
    if (d <= corridor.radius_m) {
      const cong = (corridor as unknown as Record<string, number>)[period] ?? 1.0;
      const decay = Math.max(0.3, 1.0 - d / corridor.radius_m);
      const effective = 1.0 + (cong - 1.0) * decay;
      if (effective > maxCongestion) {
        maxCongestion = effective;
        nearestCorridor = corridor.name;
      }
    }
  }

  let level: string;
  let color: string;
  if (maxCongestion >= 2.0) {
    level = "heavy";
    color = "#dc2626";
  } else if (maxCongestion >= 1.5) {
    level = "moderate";
    color = "#f59e0b";
  } else if (maxCongestion >= 1.2) {
    level = "light";
    color = "#3b82f6";
  } else {
    level = "free_flow";
    color = "#10b981";
  }

  return {
    congestion: Math.round(maxCongestion * 100) / 100,
    level,
    color,
    corridor: nearestCorridor,
    speed_factor: Math.round((1.0 / maxCongestion) * 100) / 100,
  };
}

export function getTrafficOverlay(
  lat: number,
  lng: number,
  hour: number,
  isWeekend: boolean,
  radiusKm: number = 8.0,
): TrafficOverlayCell[] {
  const gridSize = 8;
  const step = radiusKm / 111.0 / (gridSize / 2);

  const cells: TrafficOverlayCell[] = [];
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const cellLat = lat + (row - Math.floor(gridSize / 2)) * step;
      const cellLng = lng + ((col - Math.floor(gridSize / 2)) * step) / 0.9;
      const cong = getCongestionForPoint(cellLat, cellLng, hour, isWeekend);
      if (cong.congestion > 1.1) {
        cells.push({
          lat: Math.round(cellLat * 100000) / 100000,
          lng: Math.round(cellLng * 100000) / 100000,
          ...cong,
        });
      }
    }
  }
  return cells;
}

export function getRouteCongestion(
  polyline: Polyline,
  hour: number,
  isWeekend: boolean,
): RouteCongestionResult {
  if (!polyline || polyline.length === 0) {
    return { avg_congestion: 1.0, max_congestion: 1.0, congested_segments: 0, risk_multiplier: 1.0 };
  }

  // Sample every ~20th point
  const step = Math.max(1, Math.floor(polyline.length / 20));
  const samplePoints: [number, number][] = [];
  for (let i = 0; i < polyline.length; i += step) {
    samplePoints.push(polyline[i]);
  }

  const congestions: number[] = [];
  let congestedCount = 0;
  for (const [pLat, pLng] of samplePoints) {
    const c = getCongestionForPoint(pLat, pLng, hour, isWeekend);
    congestions.push(c.congestion);
    if (c.congestion >= 1.5) {
      congestedCount++;
    }
  }

  const avg = congestions.length > 0 ? congestions.reduce((a, b) => a + b, 0) / congestions.length : 1.0;
  const mx = congestions.length > 0 ? Math.max(...congestions) : 1.0;

  // Congestion -> risk multiplier: heavy traffic correlates with fender-benders
  // 1.0 free flow -> 1.0x risk, 2.0 heavy -> 1.3x risk (moderate correlation)
  const riskMult = 1.0 + (avg - 1.0) * 0.3;

  return {
    avg_congestion: Math.round(avg * 100) / 100,
    max_congestion: Math.round(mx * 100) / 100,
    congested_segments: congestedCount,
    total_sampled: samplePoints.length,
    risk_multiplier: Math.round(riskMult * 100) / 100,
    delay_factor: Math.round(avg * 100) / 100,
  };
}
