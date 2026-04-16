"""Live weather via Open-Meteo (free, no API key).
Maps WMO weather codes to our risk-engine weather categories."""
from __future__ import annotations
from typing import Dict, Optional
import httpx

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# WMO weather code → our category
WMO_TO_CATEGORY = {
    0: "clear", 1: "clear", 2: "cloudy", 3: "cloudy",
    45: "fog", 48: "fog",
    51: "rain", 53: "rain", 55: "rain",
    56: "rain", 57: "heavy_rain",
    61: "rain", 63: "rain", 65: "heavy_rain",
    66: "rain", 67: "heavy_rain",
    71: "fog", 73: "fog", 75: "fog",  # snow → treat as fog (low visibility)
    77: "fog",
    80: "rain", 81: "rain", 82: "heavy_rain",
    85: "fog", 86: "fog",
    95: "heavy_rain", 96: "heavy_rain", 99: "heavy_rain",  # thunderstorm
}

WMO_TO_LABEL = {
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
}


async def fetch_live_weather(lat: float, lng: float) -> Dict:
    """Get current weather for a coordinate. Returns our category + metadata."""
    params = {
        "latitude": lat,
        "longitude": lng,
        "current": "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,visibility",
        "timezone": "auto",
        "forecast_days": 1,
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(OPEN_METEO_URL, params=params)
            r.raise_for_status()
            data = r.json()

        current = data.get("current", {})
        code = current.get("weather_code", 0)
        category = WMO_TO_CATEGORY.get(code, "clear")
        label = WMO_TO_LABEL.get(code, "Unknown")
        visibility = current.get("visibility", 10000)

        # Override: if visibility < 1km, treat as fog regardless of code
        if visibility is not None and visibility < 1000:
            category = "fog"

        return {
            "category": category,
            "label": label,
            "wmo_code": code,
            "temperature_c": current.get("temperature_2m"),
            "humidity_pct": current.get("relative_humidity_2m"),
            "wind_kmh": current.get("wind_speed_10m"),
            "visibility_m": visibility,
            "source": "open-meteo",
        }
    except Exception as e:
        print(f"[weather] Open-Meteo failed: {e}, returning clear")
        return {
            "category": "clear",
            "label": "Unknown (API unavailable)",
            "wmo_code": -1,
            "temperature_c": None,
            "humidity_pct": None,
            "wind_kmh": None,
            "visibility_m": None,
            "source": "fallback",
        }
