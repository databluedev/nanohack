/**
 * Route fetching with OSRM public demo -- now with turn-by-turn steps.
 * Graceful interpolated fallback so the demo never hard-fails.
 */

export type Polyline = [number, number][];

export interface RouteStep {
  instruction: string;
  distance_m: number;
  duration_s: number;
  name: string;
  maneuver_type: string;
  modifier: string;
  icon: string;
  location: [number, number];
  polyline: Polyline;
}

export interface Route {
  id: string;
  polyline: Polyline;
  distance_m: number;
  duration_s: number;
  source: string;
  steps: RouteStep[];
}

const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

export const MANEUVER_ICONS: Record<string, string> = {
  "turn": "turn",
  "new name": "straight",
  "depart": "depart",
  "arrive": "arrive",
  "merge": "merge",
  "on ramp": "ramp",
  "off ramp": "ramp",
  "fork": "fork",
  "end of road": "end",
  "continue": "straight",
  "roundabout": "roundabout",
  "rotary": "roundabout",
  "roundabout turn": "roundabout",
  "notification": "info",
  "exit roundabout": "roundabout",
  "exit rotary": "roundabout",
};

function buildInstruction(step: Record<string, unknown>): string {
  const maneuver = (step.maneuver || {}) as Record<string, unknown>;
  const mtype = (maneuver.type || "") as string;
  const modifier = (maneuver.modifier || "") as string;
  const name = (step.name || "") as string;

  if (mtype === "depart") {
    return name ? `Head ${modifier} on ${name}` : `Head ${modifier}`;
  }
  if (mtype === "arrive") {
    return "You have arrived at your destination";
  }
  if (mtype === "turn") {
    const direction = modifier
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    return name ? `Turn ${direction} onto ${name}` : `Turn ${direction}`;
  }
  if (mtype === "roundabout" || mtype === "rotary") {
    const exitNum = maneuver.exit || "";
    return name
      ? `Take exit ${exitNum} at the roundabout onto ${name}`
      : `Take exit ${exitNum} at the roundabout`;
  }
  if (mtype === "merge") {
    return name ? `Merge ${modifier} onto ${name}` : `Merge ${modifier}`;
  }
  if (mtype === "fork") {
    return name ? `Keep ${modifier} onto ${name}` : `Keep ${modifier}`;
  }
  if (mtype === "new name" || mtype === "continue") {
    return name ? `Continue onto ${name}` : "Continue straight";
  }
  if (mtype === "on ramp" || mtype === "off ramp") {
    return name ? `Take the ramp onto ${name}` : "Take the ramp";
  }
  if (mtype === "end of road") {
    return name
      ? `Turn ${modifier} at the end of the road onto ${name}`
      : `Turn ${modifier}`;
  }

  return `${mtype.charAt(0).toUpperCase() + mtype.slice(1)} ${modifier} ${name}`.trim();
}

const EARTH_R = 6371000.0;

function haversineM(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const p1 = (aLat * Math.PI) / 180;
  const p2 = (bLat * Math.PI) / 180;
  const dp = ((bLat - aLat) * Math.PI) / 180;
  const dl = ((bLng - aLng) * Math.PI) / 180;
  const h =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

function fallbackRoute(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): Route {
  const N = 50;
  const midLat = (aLat + bLat) / 2;
  const midLng = (aLng + bLng) / 2;
  const dx = bLng - aLng;
  const dy = bLat - aLat;
  const perpLat = -dx * 0.05;
  const perpLng = dy * 0.05;
  const bendLat = midLat + perpLat;
  const bendLng = midLng + perpLng;

  function bezier(t: number): [number, number] {
    const u = 1 - t;
    const lat = u * u * aLat + 2 * u * t * bendLat + t * t * bLat;
    const lng = u * u * aLng + 2 * u * t * bendLng + t * t * bLng;
    return [lat, lng];
  }

  const poly: Polyline = [];
  for (let i = 0; i <= N; i++) {
    poly.push(bezier(i / N));
  }

  let dist = 0.0;
  for (let i = 1; i < poly.length; i++) {
    dist += haversineM(
      poly[i - 1][0],
      poly[i - 1][1],
      poly[i][0],
      poly[i][1],
    );
  }

  const steps: RouteStep[] = [
    {
      instruction: "Head toward your destination",
      distance_m: Math.round(dist),
      duration_s: Math.round(dist / 11.0),
      name: "",
      maneuver_type: "depart",
      modifier: "straight",
      icon: "depart",
      location: [poly[0][0], poly[0][1]],
      polyline: poly.slice(0, 25),
    },
    {
      instruction: "You have arrived at your destination",
      distance_m: 0,
      duration_s: 0,
      name: "",
      maneuver_type: "arrive",
      modifier: "",
      icon: "arrive",
      location: [poly[poly.length - 1][0], poly[poly.length - 1][1]],
      polyline: poly.slice(25),
    },
  ];

  return {
    id: "r0",
    polyline: poly,
    distance_m: dist,
    duration_s: dist / 11.0,
    source: "fallback",
    steps,
  };
}

export async function fetchRoutes(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  alternatives: number = 2,
): Promise<Route[]> {
  const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
  const url = `${OSRM_URL}/${coords}`;
  const params = new URLSearchParams({
    overview: "full",
    geometries: "geojson",
    alternatives: alternatives > 1 ? "true" : "false",
    steps: "true",
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const r = await fetch(`${url}?${params.toString()}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();

    const routes: Route[] = [];
    for (let i = 0; i < (data.routes || []).length; i++) {
      const rt = data.routes[i];
      const coordsList: [number, number][] = rt.geometry.coordinates;
      const polyline: Polyline = coordsList.map(
        (c: [number, number]) => [c[1], c[0]] as [number, number],
      );

      // Extract turn-by-turn steps
      const steps: RouteStep[] = [];
      for (const leg of rt.legs || []) {
        for (const step of leg.steps || []) {
          const maneuver = step.maneuver || {};
          const stepCoords: [number, number][] = (step.geometry
            ?.coordinates || []) as [number, number][];
          const stepPolyline: Polyline = stepCoords.map(
            (c: [number, number]) => [c[1], c[0]] as [number, number],
          );

          const loc = maneuver.location || [0, 0];
          steps.push({
            instruction: buildInstruction(step),
            distance_m: Math.round(step.distance || 0),
            duration_s: Math.round(step.duration || 0),
            name: step.name || "",
            maneuver_type: maneuver.type || "",
            modifier: maneuver.modifier || "",
            icon: MANEUVER_ICONS[maneuver.type || ""] || "straight",
            location: [loc[1], loc[0]],
            polyline: stepPolyline,
          });
        }
      }

      routes.push({
        id: `r${i}`,
        polyline,
        distance_m: rt.distance,
        duration_s: rt.duration,
        source: "osrm",
        steps,
      });
    }
    if (routes.length > 0) return routes;
  } catch (e) {
    console.log(`[routing] OSRM failed: ${e}, using fallback`);
  }

  return [fallbackRoute(fromLat, fromLng, toLat, toLng)];
}
