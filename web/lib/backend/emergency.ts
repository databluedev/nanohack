/**
 * Emergency services module -- finds nearby hospitals, police, fire stations
 * via Overpass API (OpenStreetMap), with a curated fallback for Chennai.
 */

export interface EmergencyService {
  name: string;
  type: "hospital" | "police" | "fire";
  lat: number;
  lng: number;
  phone: string;
}

export interface EmergencyServiceResult extends EmergencyService {
  distance_m: number;
  distance_km: number;
}

export interface AlertNotification {
  service: string;
  type: string;
  phone: string;
  distance_km: number;
}

export interface SimulatedAlert {
  status: "simulated";
  message: string;
  location: { lat: number; lng: number };
  type: string;
  timestamp: string | null;
  notified: AlertNotification[];
}

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export const CHENNAI_EMERGENCY_SERVICES: EmergencyService[] = [
  // Hospitals
  { name: "Rajiv Gandhi Government General Hospital", type: "hospital", lat: 13.0878, lng: 80.2785, phone: "044-25305000" },
  { name: "Apollo Hospital, Greams Road", type: "hospital", lat: 13.0604, lng: 80.2550, phone: "044-28293333" },
  { name: "MIOT International Hospital", type: "hospital", lat: 13.0120, lng: 80.1726, phone: "044-42002288" },
  { name: "Sri Ramachandra Hospital", type: "hospital", lat: 13.0350, lng: 80.1418, phone: "044-24768027" },
  { name: "Government Kilpauk Medical College Hospital", type: "hospital", lat: 13.0843, lng: 80.2421, phone: "044-26441674" },
  { name: "Tambaram Government Hospital", type: "hospital", lat: 12.9260, lng: 80.1180, phone: "044-22261223" },
  { name: "Chromepet Government Hospital", type: "hospital", lat: 12.9520, lng: 80.1430, phone: "044-22651555" },
  { name: "Adyar Cancer Institute", type: "hospital", lat: 13.0036, lng: 80.2558, phone: "044-24910754" },
  // Police Stations
  { name: "Chennai City Police HQ", type: "police", lat: 13.0891, lng: 80.2831, phone: "100" },
  { name: "Guindy Police Station", type: "police", lat: 13.0073, lng: 80.2195, phone: "044-22501820" },
  { name: "T Nagar Police Station", type: "police", lat: 13.0410, lng: 80.2330, phone: "044-24341122" },
  { name: "Adyar Police Station", type: "police", lat: 13.0058, lng: 80.2555, phone: "044-24410375" },
  { name: "Tambaram Police Station", type: "police", lat: 12.9255, lng: 80.1145, phone: "044-22261100" },
  { name: "Velachery Police Station", type: "police", lat: 12.9830, lng: 80.2200, phone: "044-22592410" },
  { name: "Porur Police Station", type: "police", lat: 13.0370, lng: 80.1560, phone: "044-24762200" },
  // Fire Stations
  { name: "Chennai Central Fire Station", type: "fire", lat: 13.0836, lng: 80.2726, phone: "101" },
  { name: "Guindy Fire Station", type: "fire", lat: 13.0050, lng: 80.2180, phone: "044-22501101" },
  { name: "Tambaram Fire Station", type: "fire", lat: 12.9240, lng: 80.1150, phone: "044-22261101" },
  { name: "Adyar Fire Station", type: "fire", lat: 13.0055, lng: 80.2530, phone: "044-24411101" },
];

function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000.0;
  const p1 = (aLat * Math.PI) / 180;
  const p2 = (bLat * Math.PI) / 180;
  const dp = ((bLat - aLat) * Math.PI) / 180;
  const dl = ((bLng - aLng) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function findNearbyServices(
  lat: number,
  lng: number,
  radiusM: number = 5000.0,
  serviceType?: string,
): EmergencyServiceResult[] {
  const results: EmergencyServiceResult[] = [];
  for (const svc of CHENNAI_EMERGENCY_SERVICES) {
    if (serviceType && svc.type !== serviceType) continue;
    const d = haversineM(lat, lng, svc.lat, svc.lng);
    if (d <= radiusM) {
      results.push({
        ...svc,
        distance_m: Math.round(d),
        distance_km: Math.round((d / 1000) * 10) / 10,
      });
    }
  }
  results.sort((a, b) => a.distance_m - b.distance_m);
  return results;
}

export async function findNearbyServicesOverpass(
  lat: number,
  lng: number,
  radiusM: number = 5000.0,
  serviceType?: string,
): Promise<EmergencyServiceResult[]> {
  const typeFilter: Record<string, string> = {
    hospital: 'node["amenity"="hospital"]',
    police: 'node["amenity"="police"]',
    fire: 'node["amenity"="fire_station"]',
  };

  let filters: string[];
  if (serviceType && serviceType in typeFilter) {
    filters = [typeFilter[serviceType]];
  } else {
    filters = Object.values(typeFilter);
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

    const results: EmergencyServiceResult[] = [];
    for (const el of data.elements || []) {
      const tags = el.tags || {};
      const amenity = tags.amenity || "";
      const svcType =
        amenity === "hospital" ? "hospital" :
        amenity === "police" ? "police" :
        amenity === "fire_station" ? "fire" : "other";
      const name = tags.name || tags.amenity || "Unknown";
      const d = haversineM(lat, lng, el.lat, el.lon);
      results.push({
        name,
        type: svcType as EmergencyService["type"],
        lat: el.lat,
        lng: el.lon,
        phone: tags.phone || tags["contact:phone"] || "",
        distance_m: Math.round(d),
        distance_km: Math.round((d / 1000) * 10) / 10,
      });
    }
    results.sort((a, b) => a.distance_m - b.distance_m);
    if (results.length > 0) return results;
  } catch (e) {
    console.log(`[emergency] Overpass failed: ${e}, using fallback`);
  }

  return findNearbyServices(lat, lng, radiusM, serviceType);
}

export function simulateAlert(
  lat: number,
  lng: number,
  userName: string = "Driver",
  alertType: string = "accident",
): SimulatedAlert {
  const nearby = findNearbyServices(lat, lng, 10000.0);

  const nearestHospital = nearby.find((s) => s.type === "hospital") || null;
  const nearestPolice = nearby.find((s) => s.type === "police") || null;
  const nearestFire = nearby.find((s) => s.type === "fire") || null;

  const alert: SimulatedAlert = {
    status: "simulated",
    message: `EMERGENCY ALERT from ${userName}`,
    location: { lat, lng },
    type: alertType,
    timestamp: null,
    notified: [],
  };

  if (nearestHospital) {
    alert.notified.push({
      service: nearestHospital.name,
      type: "hospital",
      phone: nearestHospital.phone || "",
      distance_km: nearestHospital.distance_km,
    });
  }
  if (nearestPolice) {
    alert.notified.push({
      service: nearestPolice.name,
      type: "police",
      phone: nearestPolice.phone || "",
      distance_km: nearestPolice.distance_km,
    });
  }
  if (nearestFire) {
    alert.notified.push({
      service: nearestFire.name,
      type: "fire",
      phone: nearestFire.phone || "",
      distance_km: nearestFire.distance_km,
    });
  }

  return alert;
}
