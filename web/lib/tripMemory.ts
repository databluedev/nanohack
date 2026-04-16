import type { TripMemory } from "./types";

const STORAGE_KEY = "saferoute_trip_memory";
const MAX_TRIPS = 50;

export function saveTripMemory(trip: TripMemory) {
  const trips = loadTripMemory();
  trips.unshift(trip);
  if (trips.length > MAX_TRIPS) trips.length = MAX_TRIPS;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
  } catch { /* storage full or unavailable */ }
}

export function loadTripMemory(): TripMemory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TripMemory[];
  } catch {
    return [];
  }
}

export function findPastTrip(from: string, to: string): TripMemory | null {
  const trips = loadTripMemory();
  return trips.find((t) => t.from === from && t.to === to) ?? null;
}

export function getTripInsight(from: string, to: string): string | null {
  const past = findPastTrip(from, to);
  if (!past) return null;

  const date = new Date(past.timestamp);
  const dayAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  const timeLabel = dayAgo === 0 ? "today" : dayAgo === 1 ? "yesterday" : `${dayAgo} days ago`;

  return `Last trip ${timeLabel}: risk was ${Math.round(past.risk)}/100 (${past.weather}, ${past.hour}:00). ${past.hazards} hazard${past.hazards !== 1 ? "s" : ""} encountered.`;
}
