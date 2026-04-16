/**
 * Safe Destination Discovery -- find nearby amenities located in low-risk zones.
 * Uses Overpass API for POI search and filters by the risk engine's scoring.
 */

import { CHENNAI_BLACKSPOTS, CHENNAI_SAFE_ZONES } from "./blackspots";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const EARTH_R = 6371000.0;

export interface SafeDestination {
  name: string;
  type: string;
  category: string;
  lat: number;
  lng: number;
  safe_reasons: string[];
}

export interface SafetyScore {
  safety_score: number;
  level: "safe" | "moderate" | "risky";
  in_safe_zone: string | null;
  nearest_blackspot: string | null;
  blackspot_distance_m: number | null;
}

export interface SafeDestinationResult extends SafeDestination, SafetyScore {
  distance_m: number;
  distance_km: number;
}

function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const p1 = (aLat * Math.PI) / 180;
  const p2 = (bLat * Math.PI) / 180;
  const dp = ((bLat - aLat) * Math.PI) / 180;
  const dl = ((bLng - aLng) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

export const CURATED_SAFE_DESTINATIONS: SafeDestination[] = [
  { name: "Forum Vijaya Mall", type: "parking", category: "shopping", lat: 12.9935, lng: 80.2132, safe_reasons: ["CCTV", "security guard", "well-lit"] },
  { name: "Phoenix MarketCity", type: "parking", category: "shopping", lat: 12.9877, lng: 80.2275, safe_reasons: ["24/7 security", "covered parking", "well-lit"] },
  { name: "Express Avenue Mall", type: "parking", category: "shopping", lat: 13.0580, lng: 80.2620, safe_reasons: ["CCTV", "valet parking", "police nearby"] },
  { name: "Indian Oil - Adyar", type: "fuel", category: "fuel", lat: 13.0045, lng: 80.2555, safe_reasons: ["24/7 open", "well-lit", "residential area"] },
  { name: "HP Petrol Bunk - Anna Nagar", type: "fuel", category: "fuel", lat: 13.0860, lng: 80.2100, safe_reasons: ["police patrol", "wide road", "CCTV"] },
  { name: "Bharat Petroleum - Guindy", type: "fuel", category: "fuel", lat: 13.0080, lng: 80.2210, safe_reasons: ["24/7 open", "security", "main road"] },
  { name: "Sangeetha Restaurant - T Nagar", type: "restaurant", category: "food", lat: 13.0415, lng: 80.2335, safe_reasons: ["busy area", "well-lit", "parking available"] },
  { name: "Saravana Bhavan - Mylapore", type: "restaurant", category: "food", lat: 13.0340, lng: 80.2680, safe_reasons: ["landmark restaurant", "busy area", "safe neighborhood"] },
  { name: "Apollo Hospital Parking", type: "parking", category: "hospital", lat: 13.0604, lng: 80.2550, safe_reasons: ["24/7 security", "CCTV", "emergency access"] },
  { name: "Tidel Park Parking", type: "parking", category: "office", lat: 12.9480, lng: 80.2370, safe_reasons: ["IT park security", "gated entry", "CCTV"] },
  { name: "ITC Grand Chola - Guindy", type: "parking", category: "hotel", lat: 13.0105, lng: 80.2175, safe_reasons: ["premium security", "valet", "well-lit"] },
  { name: "BPCL - OMR Thoraipakkam", type: "fuel", category: "fuel", lat: 12.9400, lng: 80.2390, safe_reasons: ["main road", "well-lit", "24/7"] },
];

export function computeSafetyScore(lat: number, lng: number): SafetyScore {
  // Penalty from nearby blackspots
  let blackspotPenalty = 0.0;
  let nearestBlackspot: [string, number] | null = null;
  for (const spot of CHENNAI_BLACKSPOTS) {
    const d = haversine(lat, lng, spot.lat, spot.lng);
    if (d < 2000) {
      const penalty = (spot.base * Math.max(0.1, 1.0 - d / 2000.0)) / 100.0;
      blackspotPenalty += penalty;
      if (nearestBlackspot === null || d < nearestBlackspot[1]) {
        nearestBlackspot = [spot.name, d];
      }
    }
  }

  // Bonus from safe zones
  let safeZoneBonus = 0.0;
  let inSafeZone: string | null = null;
  for (const zone of CHENNAI_SAFE_ZONES) {
    const d = haversine(lat, lng, zone.lat, zone.lng);
    if (d <= zone.radius_m) {
      safeZoneBonus = 20.0;
      inSafeZone = zone.name;
      break;
    }
  }

  // Score: 100 = perfectly safe, 0 = very dangerous
  const raw = 80 - blackspotPenalty * 50 + safeZoneBonus;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return {
    safety_score: score,
    level: score >= 70 ? "safe" : score >= 40 ? "moderate" : "risky",
    in_safe_zone: inSafeZone,
    nearest_blackspot: nearestBlackspot ? nearestBlackspot[0] : null,
    blackspot_distance_m: nearestBlackspot ? Math.round(nearestBlackspot[1]) : null,
  };
}

export function findSafeDestinations(
  lat: number,
  lng: number,
  category?: string,
  radiusM: number = 5000.0,
  minSafety: number = 50,
): SafeDestinationResult[] {
  const results: SafeDestinationResult[] = [];
  for (const dest of CURATED_SAFE_DESTINATIONS) {
    if (category && dest.category !== category && dest.type !== category) continue;
    const d = haversine(lat, lng, dest.lat, dest.lng);
    if (d > radiusM) continue;
    const safety = computeSafetyScore(dest.lat, dest.lng);
    if (safety.safety_score < minSafety) continue;
    results.push({
      ...dest,
      distance_m: Math.round(d),
      distance_km: Math.round((d / 1000) * 10) / 10,
      ...safety,
    });
  }

  results.sort((a, b) => {
    if (b.safety_score !== a.safety_score) return b.safety_score - a.safety_score;
    return a.distance_m - b.distance_m;
  });
  return results;
}

export async function findSafeDestinationsOverpass(
  lat: number,
  lng: number,
  category?: string,
  radiusM: number = 5000.0,
  minSafety: number = 50,
): Promise<SafeDestinationResult[]> {
  const amenityMap: Record<string, string> = {
    fuel: 'node["amenity"="fuel"]',
    parking: 'node["amenity"="parking"]',
    food: 'node["amenity"~"restaurant|cafe|fast_food"]',
    hospital: 'node["amenity"="hospital"]',
    hotel: 'node["tourism"="hotel"]',
  };

  let filters: string[];
  if (category && category in amenityMap) {
    filters = [amenityMap[category]];
  } else {
    filters = Object.values(amenityMap);
  }

  const queryParts = filters.map((f) => `${f}(around:${radiusM},${lat},${lng});`).join("");
  const query = `[out:json][timeout:5];(${queryParts});out body;`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const r = await fetch(OVERPASS_URL, {
      method: "POST",
      body: new URLSearchParams({ data: query }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();

    const results: SafeDestinationResult[] = [];
    for (const el of data.elements || []) {
      const tags = el.tags || {};
      const name = tags.name || tags.amenity || tags.tourism || "Unknown";
      const amenity = tags.amenity || tags.tourism || "";
      const d = haversine(lat, lng, el.lat, el.lon);

      const safety = computeSafetyScore(el.lat, el.lon);
      if (safety.safety_score < minSafety) continue;

      const cat =
        amenity === "fuel" ? "fuel" :
        amenity === "parking" ? "parking" :
        ["restaurant", "cafe", "fast_food"].includes(amenity) ? "food" :
        amenity === "hospital" ? "hospital" :
        amenity === "hotel" ? "hotel" : "other";

      results.push({
        name,
        type: amenity,
        category: cat,
        lat: el.lat,
        lng: el.lon,
        safe_reasons: safety.in_safe_zone ? ["in safe zone"] : [],
        distance_m: Math.round(d),
        distance_km: Math.round((d / 1000) * 10) / 10,
        ...safety,
      });
    }

    results.sort((a, b) => {
      if (b.safety_score !== a.safety_score) return b.safety_score - a.safety_score;
      return a.distance_m - b.distance_m;
    });
    if (results.length > 0) return results.slice(0, 20);
  } catch (e) {
    console.log(`[destinations] Overpass failed: ${e}, using fallback`);
  }

  return findSafeDestinations(lat, lng, category, radiusM, minSafety);
}
