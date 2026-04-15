"""Route fetching with OSRM public demo, with a graceful interpolated fallback
so the demo never hard-fails if OSRM is rate-limited or down."""
from __future__ import annotations
import math
from typing import List, Tuple, Dict
import httpx

OSRM_URL = "https://router.project-osrm.org/route/v1/driving"

async def fetch_routes(
    from_lat: float, from_lng: float,
    to_lat: float, to_lng: float,
    alternatives: int = 2,
) -> List[Dict]:
    """Returns a list of route dicts. Falls back to interpolated polyline on failure."""
    coords = f"{from_lng},{from_lat};{to_lng},{to_lat}"
    url = f"{OSRM_URL}/{coords}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "alternatives": "true" if alternatives > 1 else "false",
        "steps": "false",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            data = r.json()
        routes = []
        for i, rt in enumerate(data.get("routes", [])):
            coords_list = rt["geometry"]["coordinates"]  # [lng, lat]
            polyline = [(c[1], c[0]) for c in coords_list]
            routes.append({
                "id": f"r{i}",
                "polyline": polyline,
                "distance_m": rt["distance"],
                "duration_s": rt["duration"],
                "source": "osrm",
            })
        if routes:
            return routes
    except Exception as e:
        print(f"[routing] OSRM failed: {e}, using fallback")

    # Fallback: interpolated polyline with a slight curve
    return [_fallback_route(from_lat, from_lng, to_lat, to_lng)]

def _fallback_route(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> Dict:
    # Simple curved interpolation with ~50 points
    N = 50
    poly = []
    # Bend midpoint slightly perpendicular for "road-like" shape
    mid_lat = (a_lat + b_lat) / 2
    mid_lng = (a_lng + b_lng) / 2
    dx = b_lng - a_lng
    dy = b_lat - a_lat
    perp_lat = -dx * 0.05
    perp_lng = dy * 0.05
    bend_lat = mid_lat + perp_lat
    bend_lng = mid_lng + perp_lng

    def bezier(t):
        u = 1 - t
        lat = u*u*a_lat + 2*u*t*bend_lat + t*t*b_lat
        lng = u*u*a_lng + 2*u*t*bend_lng + t*t*b_lng
        return (lat, lng)

    for i in range(N + 1):
        poly.append(bezier(i / N))

    # Approx distance
    dist = 0.0
    for i in range(1, len(poly)):
        from risk_engine import haversine_m
        dist += haversine_m(poly[i-1][0], poly[i-1][1], poly[i][0], poly[i][1])

    return {
        "id": "r0",
        "polyline": poly,
        "distance_m": dist,
        "duration_s": dist / 11.0,  # ~40 km/h
        "source": "fallback",
    }
