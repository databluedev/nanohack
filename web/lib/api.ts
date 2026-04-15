import type { LatLng, Route, Weather, WindowResult } from "./types";

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return (await r.json()) as T;
}

export async function fetchRoutes(opts: {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  departure: string;
  weather: Weather;
}): Promise<{ routes: Route[]; count: number }> {
  return post("/api/route", {
    from_lat: opts.from.lat,
    from_lng: opts.from.lng,
    to_lat: opts.to.lat,
    to_lng: opts.to.lng,
    departure: opts.departure,
    weather: opts.weather,
    alternatives: 2,
  });
}

export async function fetchWindow(opts: {
  polyline: LatLng[];
  weather: Weather;
  base: string;
}): Promise<WindowResult> {
  return post("/api/window", {
    polyline: opts.polyline,
    weather: opts.weather,
    base: opts.base,
    horizon_hours: 6,
    step_min: 30,
  });
}
