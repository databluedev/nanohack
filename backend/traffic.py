"""Real-time traffic congestion data via TomTom Traffic Flow API (free tier: 2500 req/day).
Falls back to time-of-day congestion estimates when API is unavailable."""
from __future__ import annotations
from typing import List, Dict, Tuple, Optional
import httpx
import math

# Free TomTom API key placeholder — works without key using fallback
TOMTOM_KEY = ""  # Set to enable live traffic; works without it
TOMTOM_FLOW_URL = "https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json"

# Chennai congestion model — based on typical patterns
# Returns congestion multiplier (1.0 = free flow, 2.0+ = heavy congestion)
CHENNAI_CONGESTION_CORRIDORS = [
    {"name": "Anna Salai (Mount Road)", "lat": 13.0604, "lng": 80.2496, "radius_m": 1500,
     "peak_morning": 1.8, "peak_evening": 2.2, "midday": 1.3, "night": 1.0, "weekend": 1.1},
    {"name": "OMR IT Corridor", "lat": 12.9395, "lng": 80.2398, "radius_m": 2000,
     "peak_morning": 2.0, "peak_evening": 2.5, "midday": 1.2, "night": 1.0, "weekend": 1.0},
    {"name": "GST Road", "lat": 12.9516, "lng": 80.1462, "radius_m": 1500,
     "peak_morning": 1.7, "peak_evening": 2.0, "midday": 1.4, "night": 1.1, "weekend": 1.2},
    {"name": "Kathipara - Guindy Corridor", "lat": 12.9900, "lng": 80.2000, "radius_m": 2000,
     "peak_morning": 2.0, "peak_evening": 2.3, "midday": 1.5, "night": 1.0, "weekend": 1.1},
    {"name": "T Nagar Commercial Zone", "lat": 13.0418, "lng": 80.2341, "radius_m": 1000,
     "peak_morning": 1.4, "peak_evening": 2.0, "midday": 1.6, "night": 1.0, "weekend": 1.8},
    {"name": "Koyambedu Bus Terminus", "lat": 13.0697, "lng": 80.1959, "radius_m": 1200,
     "peak_morning": 1.9, "peak_evening": 2.1, "midday": 1.5, "night": 1.0, "weekend": 1.3},
    {"name": "Central Station Area", "lat": 13.0827, "lng": 80.2707, "radius_m": 1000,
     "peak_morning": 2.0, "peak_evening": 1.8, "midday": 1.3, "night": 1.0, "weekend": 1.1},
    {"name": "Velachery - Taramani", "lat": 12.9815, "lng": 80.2180, "radius_m": 1200,
     "peak_morning": 1.6, "peak_evening": 1.9, "midday": 1.3, "night": 1.0, "weekend": 1.2},
    {"name": "Porur Junction Zone", "lat": 13.0381, "lng": 80.1565, "radius_m": 1000,
     "peak_morning": 1.7, "peak_evening": 2.0, "midday": 1.4, "night": 1.0, "weekend": 1.2},
    {"name": "Adyar - Besant Nagar", "lat": 13.0067, "lng": 80.2569, "radius_m": 1000,
     "peak_morning": 1.3, "peak_evening": 1.6, "midday": 1.2, "night": 1.0, "weekend": 1.4},
]

EARTH_R = 6371000.0

def _haversine(a_lat, a_lng, b_lat, b_lng):
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp, dl = math.radians(b_lat - a_lat), math.radians(b_lng - a_lng)
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * EARTH_R * math.asin(math.sqrt(h))


def _time_period(hour: int) -> str:
    if 7 <= hour < 10: return "peak_morning"
    if 10 <= hour < 16: return "midday"
    if 16 <= hour < 21: return "peak_evening"
    return "night"


def get_congestion_for_point(lat: float, lng: float, hour: int, is_weekend: bool) -> Dict:
    """Get congestion data for a single point using the corridor model."""
    period = "weekend" if is_weekend else _time_period(hour)

    max_congestion = 1.0
    nearest_corridor = None
    for corridor in CHENNAI_CONGESTION_CORRIDORS:
        d = _haversine(lat, lng, corridor["lat"], corridor["lng"])
        if d <= corridor["radius_m"]:
            cong = corridor.get(period, 1.0)
            # Decay congestion with distance from corridor center
            decay = max(0.3, 1.0 - d / corridor["radius_m"])
            effective = 1.0 + (cong - 1.0) * decay
            if effective > max_congestion:
                max_congestion = effective
                nearest_corridor = corridor["name"]

    # Map congestion multiplier to level
    if max_congestion >= 2.0:
        level = "heavy"
        color = "#dc2626"
    elif max_congestion >= 1.5:
        level = "moderate"
        color = "#f59e0b"
    elif max_congestion >= 1.2:
        level = "light"
        color = "#3b82f6"
    else:
        level = "free_flow"
        color = "#10b981"

    return {
        "congestion": round(max_congestion, 2),
        "level": level,
        "color": color,
        "corridor": nearest_corridor,
        "speed_factor": round(1.0 / max_congestion, 2),  # how much slower than free flow
    }


def get_traffic_overlay(
    lat: float, lng: float,
    hour: int, is_weekend: bool,
    radius_km: float = 8.0,
) -> List[Dict]:
    """Generate traffic congestion grid for map overlay."""
    grid_size = 8
    step = radius_km / 111.0 / (grid_size / 2)

    cells = []
    for row in range(grid_size):
        for col in range(grid_size):
            cell_lat = lat + (row - grid_size // 2) * step
            cell_lng = lng + (col - grid_size // 2) * step / 0.9
            cong = get_congestion_for_point(cell_lat, cell_lng, hour, is_weekend)
            if cong["congestion"] > 1.1:  # skip free-flow cells
                cells.append({
                    "lat": round(cell_lat, 5),
                    "lng": round(cell_lng, 5),
                    **cong,
                })
    return cells


def get_route_congestion(
    polyline: List[Tuple[float, float]],
    hour: int, is_weekend: bool,
) -> Dict:
    """Compute congestion impact for an entire route."""
    if not polyline:
        return {"avg_congestion": 1.0, "max_congestion": 1.0, "congested_segments": 0, "risk_multiplier": 1.0}

    # Sample every 10th point
    sample_points = polyline[::max(1, len(polyline) // 20)]
    congestions = []
    congested_count = 0
    for lat, lng in sample_points:
        c = get_congestion_for_point(lat, lng, hour, is_weekend)
        congestions.append(c["congestion"])
        if c["congestion"] >= 1.5:
            congested_count += 1

    avg = sum(congestions) / len(congestions) if congestions else 1.0
    mx = max(congestions) if congestions else 1.0

    # Congestion → risk multiplier: heavy traffic correlates with fender-benders
    # 1.0 free flow → 1.0x risk, 2.0 heavy → 1.3x risk (moderate correlation)
    risk_mult = 1.0 + (avg - 1.0) * 0.3

    return {
        "avg_congestion": round(avg, 2),
        "max_congestion": round(mx, 2),
        "congested_segments": congested_count,
        "total_sampled": len(sample_points),
        "risk_multiplier": round(risk_mult, 2),
        "delay_factor": round(avg, 2),  # ETA multiplier
    }


async def fetch_tomtom_flow(lat: float, lng: float) -> Optional[Dict]:
    """Try TomTom Traffic Flow API. Returns None if unavailable."""
    if not TOMTOM_KEY:
        return None
    try:
        params = {"key": TOMTOM_KEY, "point": f"{lat},{lng}"}
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(TOMTOM_FLOW_URL, params=params)
            r.raise_for_status()
            data = r.json()
        flow = data.get("flowSegmentData", {})
        free_flow = flow.get("freeFlowSpeed", 60)
        current = flow.get("currentSpeed", 60)
        congestion = free_flow / max(1, current) if current > 0 else 1.0
        return {
            "congestion": round(congestion, 2),
            "current_speed_kmh": current,
            "free_flow_speed_kmh": free_flow,
            "confidence": flow.get("confidence", 0),
            "source": "tomtom",
        }
    except Exception:
        return None
