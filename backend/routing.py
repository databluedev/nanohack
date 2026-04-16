"""Route fetching with OSRM public demo — now with turn-by-turn steps.
Graceful interpolated fallback so the demo never hard-fails."""
from __future__ import annotations
import math
from typing import List, Tuple, Dict
import httpx

OSRM_URL = "https://router.project-osrm.org/route/v1/driving"

MANEUVER_ICONS = {
    "turn": "turn", "new name": "straight", "depart": "depart",
    "arrive": "arrive", "merge": "merge", "on ramp": "ramp",
    "off ramp": "ramp", "fork": "fork", "end of road": "end",
    "continue": "straight", "roundabout": "roundabout",
    "rotary": "roundabout", "roundabout turn": "roundabout",
    "notification": "info", "exit roundabout": "roundabout",
    "exit rotary": "roundabout",
}

def _build_instruction(step: Dict) -> str:
    """Build a human-readable instruction from OSRM step."""
    maneuver = step.get("maneuver", {})
    mtype = maneuver.get("type", "")
    modifier = maneuver.get("modifier", "")
    name = step.get("name", "")
    dist = step.get("distance", 0)

    if mtype == "depart":
        return f"Head {modifier} on {name}" if name else f"Head {modifier}"
    if mtype == "arrive":
        return "You have arrived at your destination"
    if mtype == "turn":
        direction = modifier.replace(" ", " ").title()
        return f"Turn {direction} onto {name}" if name else f"Turn {direction}"
    if mtype == "roundabout" or mtype == "rotary":
        exit_num = maneuver.get("exit", "")
        return f"Take exit {exit_num} at the roundabout onto {name}" if name else f"Take exit {exit_num} at the roundabout"
    if mtype == "merge":
        return f"Merge {modifier} onto {name}" if name else f"Merge {modifier}"
    if mtype == "fork":
        return f"Keep {modifier} onto {name}" if name else f"Keep {modifier}"
    if mtype == "new name" or mtype == "continue":
        return f"Continue onto {name}" if name else "Continue straight"
    if mtype in ("on ramp", "off ramp"):
        return f"Take the ramp onto {name}" if name else "Take the ramp"
    if mtype == "end of road":
        return f"Turn {modifier} at the end of the road onto {name}" if name else f"Turn {modifier}"

    return f"{mtype.title()} {modifier} {name}".strip()


async def fetch_routes(
    from_lat: float, from_lng: float,
    to_lat: float, to_lng: float,
    alternatives: int = 2,
) -> List[Dict]:
    """Returns routes with polylines AND turn-by-turn navigation steps."""
    coords = f"{from_lng},{from_lat};{to_lng},{to_lat}"
    url = f"{OSRM_URL}/{coords}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "alternatives": "true" if alternatives > 1 else "false",
        "steps": "true",  # Enable turn-by-turn
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

            # Extract turn-by-turn steps
            steps = []
            for leg in rt.get("legs", []):
                for step in leg.get("steps", []):
                    maneuver = step.get("maneuver", {})
                    step_coords = step.get("geometry", {}).get("coordinates", [])
                    step_polyline = [(c[1], c[0]) for c in step_coords] if step_coords else []

                    steps.append({
                        "instruction": _build_instruction(step),
                        "distance_m": round(step.get("distance", 0)),
                        "duration_s": round(step.get("duration", 0)),
                        "name": step.get("name", ""),
                        "maneuver_type": maneuver.get("type", ""),
                        "modifier": maneuver.get("modifier", ""),
                        "icon": MANEUVER_ICONS.get(maneuver.get("type", ""), "straight"),
                        "location": [maneuver.get("location", [0, 0])[1], maneuver.get("location", [0, 0])[0]],  # [lat, lng]
                        "polyline": step_polyline,
                    })

            routes.append({
                "id": f"r{i}",
                "polyline": polyline,
                "distance_m": rt["distance"],
                "duration_s": rt["duration"],
                "source": "osrm",
                "steps": steps,
            })
        if routes:
            return routes
    except Exception as e:
        print(f"[routing] OSRM failed: {e}, using fallback")

    return [_fallback_route(from_lat, from_lng, to_lat, to_lng)]


def _fallback_route(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> Dict:
    N = 50
    poly = []
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
        lat = u * u * a_lat + 2 * u * t * bend_lat + t * t * b_lat
        lng = u * u * a_lng + 2 * u * t * bend_lng + t * t * b_lng
        return (lat, lng)

    for i in range(N + 1):
        poly.append(bezier(i / N))

    dist = 0.0
    for i in range(1, len(poly)):
        from risk_engine import haversine_m
        dist += haversine_m(poly[i - 1][0], poly[i - 1][1], poly[i][0], poly[i][1])

    # Generate fallback steps
    steps = [
        {"instruction": "Head toward your destination", "distance_m": round(dist),
         "duration_s": round(dist / 11.0), "name": "", "maneuver_type": "depart",
         "modifier": "straight", "icon": "depart", "location": list(poly[0]), "polyline": poly[:25]},
        {"instruction": "You have arrived at your destination", "distance_m": 0,
         "duration_s": 0, "name": "", "maneuver_type": "arrive",
         "modifier": "", "icon": "arrive", "location": list(poly[-1]), "polyline": poly[25:]},
    ]

    return {
        "id": "r0",
        "polyline": poly,
        "distance_m": dist,
        "duration_s": dist / 11.0,
        "source": "fallback",
        "steps": steps,
    }
