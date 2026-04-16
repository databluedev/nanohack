"""Safe Destination Discovery — find nearby amenities located in low-risk zones.
Uses Overpass API for POI search and filters by the risk engine's scoring."""
from __future__ import annotations
import math
from typing import List, Dict, Optional
import httpx

from blackspots import CHENNAI_BLACKSPOTS, CHENNAI_SAFE_ZONES

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
EARTH_R = 6371000.0

def _haversine(a_lat, a_lng, b_lat, b_lng):
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp, dl = math.radians(b_lat - a_lat), math.radians(b_lng - a_lng)
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * EARTH_R * math.asin(math.sqrt(h))


# Curated Chennai amenities in known safe areas (fallback)
CURATED_SAFE_DESTINATIONS = [
    {"name": "Forum Vijaya Mall", "type": "parking", "category": "shopping",
     "lat": 12.9935, "lng": 80.2132, "safe_reasons": ["CCTV", "security guard", "well-lit"]},
    {"name": "Phoenix MarketCity", "type": "parking", "category": "shopping",
     "lat": 12.9877, "lng": 80.2275, "safe_reasons": ["24/7 security", "covered parking", "well-lit"]},
    {"name": "Express Avenue Mall", "type": "parking", "category": "shopping",
     "lat": 13.0580, "lng": 80.2620, "safe_reasons": ["CCTV", "valet parking", "police nearby"]},
    {"name": "Indian Oil - Adyar", "type": "fuel", "category": "fuel",
     "lat": 13.0045, "lng": 80.2555, "safe_reasons": ["24/7 open", "well-lit", "residential area"]},
    {"name": "HP Petrol Bunk - Anna Nagar", "type": "fuel", "category": "fuel",
     "lat": 13.0860, "lng": 80.2100, "safe_reasons": ["police patrol", "wide road", "CCTV"]},
    {"name": "Bharat Petroleum - Guindy", "type": "fuel", "category": "fuel",
     "lat": 13.0080, "lng": 80.2210, "safe_reasons": ["24/7 open", "security", "main road"]},
    {"name": "Sangeetha Restaurant - T Nagar", "type": "restaurant", "category": "food",
     "lat": 13.0415, "lng": 80.2335, "safe_reasons": ["busy area", "well-lit", "parking available"]},
    {"name": "Saravana Bhavan - Mylapore", "type": "restaurant", "category": "food",
     "lat": 13.0340, "lng": 80.2680, "safe_reasons": ["landmark restaurant", "busy area", "safe neighborhood"]},
    {"name": "Apollo Hospital Parking", "type": "parking", "category": "hospital",
     "lat": 13.0604, "lng": 80.2550, "safe_reasons": ["24/7 security", "CCTV", "emergency access"]},
    {"name": "Tidel Park Parking", "type": "parking", "category": "office",
     "lat": 12.9480, "lng": 80.2370, "safe_reasons": ["IT park security", "gated entry", "CCTV"]},
    {"name": "ITC Grand Chola - Guindy", "type": "parking", "category": "hotel",
     "lat": 13.0105, "lng": 80.2175, "safe_reasons": ["premium security", "valet", "well-lit"]},
    {"name": "BPCL - OMR Thoraipakkam", "type": "fuel", "category": "fuel",
     "lat": 12.9400, "lng": 80.2390, "safe_reasons": ["main road", "well-lit", "24/7"]},
]


def _compute_safety_score(lat: float, lng: float) -> Dict:
    """Compute safety score for a location based on blackspot proximity and safe zone membership."""
    # Penalty from nearby blackspots
    blackspot_penalty = 0.0
    nearest_blackspot = None
    for spot in CHENNAI_BLACKSPOTS:
        d = _haversine(lat, lng, spot["lat"], spot["lng"])
        if d < 2000:
            penalty = spot["base"] * max(0.1, 1.0 - d / 2000.0) / 100.0
            blackspot_penalty += penalty
            if nearest_blackspot is None or d < nearest_blackspot[1]:
                nearest_blackspot = (spot["name"], d)

    # Bonus from safe zones
    safe_zone_bonus = 0.0
    in_safe_zone = None
    for zone in CHENNAI_SAFE_ZONES:
        d = _haversine(lat, lng, zone["lat"], zone["lng"])
        if d <= zone["radius_m"]:
            safe_zone_bonus = 20.0
            in_safe_zone = zone["name"]
            break

    # Score: 100 = perfectly safe, 0 = very dangerous
    raw = 80 - blackspot_penalty * 50 + safe_zone_bonus
    score = max(0, min(100, round(raw)))

    return {
        "safety_score": score,
        "level": "safe" if score >= 70 else "moderate" if score >= 40 else "risky",
        "in_safe_zone": in_safe_zone,
        "nearest_blackspot": nearest_blackspot[0] if nearest_blackspot else None,
        "blackspot_distance_m": round(nearest_blackspot[1]) if nearest_blackspot else None,
    }


def find_safe_destinations(
    lat: float, lng: float,
    category: Optional[str] = None,
    radius_m: float = 5000.0,
    min_safety: int = 50,
) -> List[Dict]:
    """Find amenities in low-risk zones. Uses curated data."""
    results = []
    for dest in CURATED_SAFE_DESTINATIONS:
        if category and dest["category"] != category and dest["type"] != category:
            continue
        d = _haversine(lat, lng, dest["lat"], dest["lng"])
        if d > radius_m:
            continue
        safety = _compute_safety_score(dest["lat"], dest["lng"])
        if safety["safety_score"] < min_safety:
            continue
        results.append({
            **dest,
            "distance_m": round(d),
            "distance_km": round(d / 1000, 1),
            **safety,
        })

    results.sort(key=lambda x: (-x["safety_score"], x["distance_m"]))
    return results


async def find_safe_destinations_overpass(
    lat: float, lng: float,
    category: Optional[str] = None,
    radius_m: float = 5000.0,
    min_safety: int = 50,
) -> List[Dict]:
    """Try Overpass API for real POI data, fall back to curated."""
    amenity_map = {
        "fuel": 'node["amenity"="fuel"]',
        "parking": 'node["amenity"="parking"]',
        "food": 'node["amenity"~"restaurant|cafe|fast_food"]',
        "hospital": 'node["amenity"="hospital"]',
        "hotel": 'node["tourism"="hotel"]',
    }

    if category and category in amenity_map:
        filters = [amenity_map[category]]
    else:
        filters = list(amenity_map.values())

    query_parts = "".join(f"{f}(around:{radius_m},{lat},{lng});" for f in filters)
    query = f"[out:json][timeout:5];({query_parts});out body;"

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.post(OVERPASS_URL, data={"data": query})
            r.raise_for_status()
            data = r.json()

        results = []
        for el in data.get("elements", []):
            tags = el.get("tags", {})
            name = tags.get("name", tags.get("amenity", tags.get("tourism", "Unknown")))
            amenity = tags.get("amenity", tags.get("tourism", ""))
            d = _haversine(lat, lng, el["lat"], el["lon"])

            safety = _compute_safety_score(el["lat"], el["lon"])
            if safety["safety_score"] < min_safety:
                continue

            cat = "fuel" if amenity == "fuel" else \
                  "parking" if amenity == "parking" else \
                  "food" if amenity in ("restaurant", "cafe", "fast_food") else \
                  "hospital" if amenity == "hospital" else \
                  "hotel" if amenity == "hotel" else "other"

            results.append({
                "name": name,
                "type": amenity,
                "category": cat,
                "lat": el["lat"],
                "lng": el["lon"],
                "safe_reasons": safety.get("in_safe_zone", None) and ["in safe zone"] or [],
                "distance_m": round(d),
                "distance_km": round(d / 1000, 1),
                **safety,
            })

        results.sort(key=lambda x: (-x["safety_score"], x["distance_m"]))
        if results:
            return results[:20]
    except Exception as e:
        print(f"[destinations] Overpass failed: {e}, using fallback")

    return find_safe_destinations(lat, lng, category, radius_m, min_safety)
