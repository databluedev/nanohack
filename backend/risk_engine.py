"""SafeWindow risk engine.
Pure Python, no external deps. Computes per-route risk based on:
  - Proximity of route polyline to known black spots
  - Time-of-day, weather, day-type multipliers
  - Conditional spike multipliers per black spot
"""
from __future__ import annotations
import math
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
from blackspots import CHENNAI_BLACKSPOTS

EARTH_R = 6371000.0  # meters

def haversine_m(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    p1 = math.radians(a_lat); p2 = math.radians(b_lat)
    dp = math.radians(b_lat - a_lat); dl = math.radians(b_lng - a_lng)
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * EARTH_R * math.asin(math.sqrt(h))

def time_window(hour: int) -> str:
    if 6 <= hour < 10:  return "morning"
    if 10 <= hour < 16: return "midday"
    if 16 <= hour < 20: return "evening"
    if 20 <= hour < 24: return "night"
    return "latenight"

def time_multiplier(window: str) -> float:
    return {"morning": 1.3, "midday": 0.9, "evening": 1.5, "night": 1.4, "latenight": 1.1}[window]

def weather_multiplier(weather: str) -> float:
    return {"clear": 1.0, "cloudy": 1.05, "rain": 1.6, "heavy_rain": 1.9, "fog": 1.7}.get(weather, 1.0)

def day_multiplier(day_type: str) -> float:
    return {"weekday": 1.0, "weekend": 1.15, "holiday": 1.2, "festival": 1.3}.get(day_type, 1.0)

def classify_day(dt: datetime) -> str:
    return "weekend" if dt.weekday() >= 5 else "weekday"

# ---- Spot risk along a route ----

def find_nearby_spots(polyline: List[Tuple[float, float]], radius_m: float = 600.0) -> List[Dict]:
    """Return blackspots within radius of any point on polyline, with min distance."""
    hits = []
    for spot in CHENNAI_BLACKSPOTS:
        min_d = float("inf")
        nearest_idx = 0
        for i, (lat, lng) in enumerate(polyline):
            d = haversine_m(lat, lng, spot["lat"], spot["lng"])
            if d < min_d:
                min_d = d
                nearest_idx = i
        if min_d <= radius_m:
            hits.append({
                "spot": spot,
                "distance_m": round(min_d, 1),
                "nearest_idx": nearest_idx,
            })
    return hits

def conditional_spike(spot: Dict, window: str, weather: str, day_type: str) -> float:
    spikes = spot["spikes"]
    mult = 1.0
    if window in spikes: mult *= spikes[window]
    if weather in ("rain", "heavy_rain") and "rain" in spikes: mult *= spikes["rain"]
    if day_type in ("weekend", "holiday", "festival") and "weekend" in spikes: mult *= spikes["weekend"]
    return mult

def assess_route(
    polyline: List[Tuple[float, float]],
    departure: datetime,
    weather: str = "clear",
) -> Dict:
    """Score one route. Returns total_risk (0-100), breakdown, and waypoints."""
    window = time_window(departure.hour)
    day_type = classify_day(departure)

    base_mult = time_multiplier(window) * weather_multiplier(weather) * day_multiplier(day_type)

    hits = find_nearby_spots(polyline)

    waypoints = []
    spot_risk_sum = 0.0
    for h in hits:
        spot = h["spot"]
        # Risk decays with distance from route (closer = higher exposure)
        proximity_factor = max(0.3, 1.0 - h["distance_m"] / 600.0)
        spike = conditional_spike(spot, window, weather, day_type)
        score = spot["base"] * proximity_factor * base_mult * spike / 100.0  # normalize roughly
        spot_risk_sum += score
        waypoints.append({
            "lat": spot["lat"],
            "lng": spot["lng"],
            "name": spot["name"],
            "distance_m": h["distance_m"],
            "score": round(score, 2),
            "voice": spot["voice"],
            "nearest_idx": h["nearest_idx"],
            "tags": spot.get("tags", []),
            "junction_type": spot.get("junction_type", "unknown"),
        })

    # Traffic congestion factor
    try:
        from traffic import get_route_congestion
        is_wknd = day_type in ("weekend", "holiday", "festival")
        congestion = get_route_congestion(polyline, departure.hour, is_wknd)
        traffic_mult = congestion.get("risk_multiplier", 1.0)
    except Exception:
        traffic_mult = 1.0

    # Background risk per km (structural baseline)
    length_km = polyline_length_km(polyline)
    background = length_km * 0.25 * base_mult  # ~0.25 risk per km in clear weekday midday

    total = (spot_risk_sum + background) * traffic_mult
    # Soft saturation: avoid hard 100 cap so time-slider shows variation
    # logistic-ish: 100 * total / (total + K)
    K = 30.0
    total_norm = 100.0 * total / (total + K)

    waypoints.sort(key=lambda w: -w["score"])
    return {
        "total_risk": round(total_norm, 1),
        "background_risk": round(100.0 * background / (background + K), 1),
        "spot_risk": round(100.0 * spot_risk_sum / (spot_risk_sum + K), 1),
        "length_km": round(length_km, 2),
        "context": {
            "time_window": window,
            "day_type": day_type,
            "weather": weather,
            "departure": departure.isoformat(),
        },
        "waypoints": waypoints,
    }

def polyline_length_km(poly: List[Tuple[float, float]]) -> float:
    if len(poly) < 2: return 0.0
    total = 0.0
    for i in range(1, len(poly)):
        total += haversine_m(poly[i-1][0], poly[i-1][1], poly[i][0], poly[i][1])
    return total / 1000.0

def segment_risks(polyline: List[Tuple[float, float]], waypoints: List[Dict]) -> List[Dict]:
    """For visualization: split polyline into ~20 segments, color each by max nearby risk."""
    n = len(polyline)
    if n < 2: return []
    seg_count = min(40, max(8, n // 5))
    chunk = max(1, n // seg_count)
    segments = []
    for s in range(0, n - 1, chunk):
        e = min(n - 1, s + chunk)
        seg_pts = polyline[s:e+1]
        # Find max risk among waypoints whose nearest_idx falls in this range or close
        max_score = 0.0
        for w in waypoints:
            if s - chunk <= w["nearest_idx"] <= e + chunk:
                max_score = max(max_score, w["score"])
        segments.append({
            "polyline": seg_pts,
            "score": round(max_score, 2),
            "level": risk_level(max_score),
        })
    return segments

def risk_level(score: float) -> str:
    if score >= 5.0: return "high"
    if score >= 1.5: return "medium"
    return "low"

def risk_window(
    polyline: List[Tuple[float, float]],
    base_dt: datetime,
    weather_now: str,
    horizon_hours: int = 6,
    step_min: int = 30,
) -> List[Dict]:
    """Compute total_risk for each future departure slot — powers the time-slider UI."""
    slots = []
    steps = (horizon_hours * 60) // step_min
    for i in range(steps + 1):
        dt = base_dt + timedelta(minutes=i * step_min)
        # Naively assume weather persists for next 2h, then clears
        w = weather_now if i * step_min < 120 else "clear"
        a = assess_route(polyline, dt, w)
        slots.append({
            "time": dt.isoformat(),
            "label": dt.strftime("%H:%M"),
            "risk": a["total_risk"],
            "weather": w,
        })
    return slots
