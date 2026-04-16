/**
 * Live weather via Open-Meteo (free, no API key).
 * Maps WMO weather codes to our risk-engine weather categories.
 */

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

export interface WeatherResult {
  category: string;
  label: string;
  wmo_code: number;
  temperature_c: number | null;
  humidity_pct: number | null;
  wind_kmh: number | null;
  visibility_m: number | null;
  source: string;
}

/** WMO weather code -> our risk-engine category */
export const WMO_TO_CATEGORY: Record<number, string> = {
  0: "clear", 1: "clear", 2: "cloudy", 3: "cloudy",
  45: "fog", 48: "fog",
  51: "rain", 53: "rain", 55: "rain",
  56: "rain", 57: "heavy_rain",
  61: "rain", 63: "rain", 65: "heavy_rain",
  66: "rain", 67: "heavy_rain",
  71: "fog", 73: "fog", 75: "fog",  // snow -> treat as fog (low visibility)
  77: "fog",
  80: "rain", 81: "rain", 82: "heavy_rain",
  85: "fog", 86: "fog",
  95: "heavy_rain", 96: "heavy_rain", 99: "heavy_rain",  // thunderstorm
};

/** WMO weather code -> human-readable label */
export const WMO_TO_LABEL: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Depositing rime fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
  56: "Freezing drizzle", 57: "Heavy freezing drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  66: "Freezing rain", 67: "Heavy freezing rain",
  71: "Slight snowfall", 73: "Moderate snowfall", 75: "Heavy snowfall",
  77: "Snow grains",
  80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
  85: "Slight snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm",
};

export async function fetchLiveWeather(lat: number, lng: number): Promise<WeatherResult> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,visibility",
    timezone: "auto",
    forecast_days: "1",
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const r = await fetch(`${OPEN_METEO_URL}?${params.toString()}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();

    const current = data.current || {};
    const code: number = current.weather_code ?? 0;
    let category = WMO_TO_CATEGORY[code] ?? "clear";
    const label = WMO_TO_LABEL[code] ?? "Unknown";
    const visibility: number | null = current.visibility ?? null;

    // Override: if visibility < 1km, treat as fog regardless of code
    if (visibility !== null && visibility < 1000) {
      category = "fog";
    }

    return {
      category,
      label,
      wmo_code: code,
      temperature_c: current.temperature_2m ?? null,
      humidity_pct: current.relative_humidity_2m ?? null,
      wind_kmh: current.wind_speed_10m ?? null,
      visibility_m: visibility,
      source: "open-meteo",
    };
  } catch (e) {
    console.log(`[weather] Open-Meteo failed: ${e}, returning clear`);
    return {
      category: "clear",
      label: "Unknown (API unavailable)",
      wmo_code: -1,
      temperature_c: null,
      humidity_pct: null,
      wind_kmh: null,
      visibility_m: null,
      source: "fallback",
    };
  }
}
