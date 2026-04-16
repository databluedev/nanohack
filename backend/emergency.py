"""Emergency services module — finds nearby hospitals, police, fire stations
via Overpass API (OpenStreetMap), with a curated fallback for Chennai."""
from __future__ import annotations
import math
from typing import List, Dict, Optional
import httpx

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Curated Chennai fallback data (used when Overpass is slow/down)
CHENNAI_EMERGENCY_SERVICES: List[Dict] = [
    # Hospitals
    {"name": "Rajiv Gandhi Government General Hospital", "type": "hospital",
     "lat": 13.0878, "lng": 80.2785, "phone": "044-25305000"},
    {"name": "Apollo Hospital, Greams Road", "type": "hospital",
     "lat": 13.0604, "lng": 80.2550, "phone": "044-28293333"},
    {"name": "MIOT International Hospital", "type": "hospital",
     "lat": 13.0120, "lng": 80.1726, "phone": "044-42002288"},
    {"name": "Sri Ramachandra Hospital", "type": "hospital",
     "lat": 13.0350, "lng": 80.1418, "phone": "044-24768027"},
    {"name": "Government Kilpauk Medical College Hospital", "type": "hospital",
     "lat": 13.0843, "lng": 80.2421, "phone": "044-26441674"},
    {"name": "Tambaram Government Hospital", "type": "hospital",
     "lat": 12.9260, "lng": 80.1180, "phone": "044-22261223"},
    {"name": "Chromepet Government Hospital", "type": "hospital",
     "lat": 12.9520, "lng": 80.1430, "phone": "044-22651555"},
    {"name": "Adyar Cancer Institute", "type": "hospital",
     "lat": 13.0036, "lng": 80.2558, "phone": "044-24910754"},
    # Police Stations
    {"name": "Chennai City Police HQ", "type": "police",
     "lat": 13.0891, "lng": 80.2831, "phone": "100"},
    {"name": "Guindy Police Station", "type": "police",
     "lat": 13.0073, "lng": 80.2195, "phone": "044-22501820"},
    {"name": "T Nagar Police Station", "type": "police",
     "lat": 13.0410, "lng": 80.2330, "phone": "044-24341122"},
    {"name": "Adyar Police Station", "type": "police",
     "lat": 13.0058, "lng": 80.2555, "phone": "044-24410375"},
    {"name": "Tambaram Police Station", "type": "police",
     "lat": 12.9255, "lng": 80.1145, "phone": "044-22261100"},
    {"name": "Velachery Police Station", "type": "police",
     "lat": 12.9830, "lng": 80.2200, "phone": "044-22592410"},
    {"name": "Porur Police Station", "type": "police",
     "lat": 13.0370, "lng": 80.1560, "phone": "044-24762200"},
    # Fire Stations
    {"name": "Chennai Central Fire Station", "type": "fire",
     "lat": 13.0836, "lng": 80.2726, "phone": "101"},
    {"name": "Guindy Fire Station", "type": "fire",
     "lat": 13.0050, "lng": 80.2180, "phone": "044-22501101"},
    {"name": "Tambaram Fire Station", "type": "fire",
     "lat": 12.9240, "lng": 80.1150, "phone": "044-22261101"},
    {"name": "Adyar Fire Station", "type": "fire",
     "lat": 13.0055, "lng": 80.2530, "phone": "044-24411101"},
]


def haversine_m(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    R = 6371000.0
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp = math.radians(b_lat - a_lat)
    dl = math.radians(b_lng - a_lng)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def find_nearby_services(
    lat: float, lng: float,
    radius_m: float = 5000.0,
    service_type: Optional[str] = None,
) -> List[Dict]:
    """Find emergency services near a point. Uses curated fallback data."""
    results = []
    for svc in CHENNAI_EMERGENCY_SERVICES:
        if service_type and svc["type"] != service_type:
            continue
        d = haversine_m(lat, lng, svc["lat"], svc["lng"])
        if d <= radius_m:
            results.append({
                **svc,
                "distance_m": round(d, 0),
                "distance_km": round(d / 1000, 1),
            })
    results.sort(key=lambda x: x["distance_m"])
    return results


async def find_nearby_services_overpass(
    lat: float, lng: float,
    radius_m: float = 5000.0,
    service_type: Optional[str] = None,
) -> List[Dict]:
    """Try Overpass API first, fall back to curated data."""
    type_filter = {
        "hospital": 'node["amenity"="hospital"]',
        "police": 'node["amenity"="police"]',
        "fire": 'node["amenity"="fire_station"]',
    }

    if service_type and service_type in type_filter:
        filters = [type_filter[service_type]]
    else:
        filters = list(type_filter.values())

    query_parts = "".join(
        f"{f}(around:{radius_m},{lat},{lng});" for f in filters
    )
    query = f"[out:json][timeout:5];({query_parts});out body;"

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.post(OVERPASS_URL, data={"data": query})
            r.raise_for_status()
            data = r.json()

        results = []
        for el in data.get("elements", []):
            tags = el.get("tags", {})
            amenity = tags.get("amenity", "")
            svc_type = "hospital" if amenity == "hospital" else \
                       "police" if amenity == "police" else \
                       "fire" if amenity == "fire_station" else "other"
            name = tags.get("name", tags.get("amenity", "Unknown"))
            d = haversine_m(lat, lng, el["lat"], el["lon"])
            results.append({
                "name": name,
                "type": svc_type,
                "lat": el["lat"],
                "lng": el["lon"],
                "phone": tags.get("phone", tags.get("contact:phone", "")),
                "distance_m": round(d, 0),
                "distance_km": round(d / 1000, 1),
            })
        results.sort(key=lambda x: x["distance_m"])
        if results:
            return results
    except Exception as e:
        print(f"[emergency] Overpass failed: {e}, using fallback")

    return find_nearby_services(lat, lng, radius_m, service_type)


def simulate_alert(
    lat: float, lng: float,
    user_name: str = "Driver",
    alert_type: str = "accident",
) -> Dict:
    """Simulate sending emergency alert. Returns what would be sent."""
    nearby = find_nearby_services(lat, lng, radius_m=10000.0)

    nearest_hospital = next((s for s in nearby if s["type"] == "hospital"), None)
    nearest_police = next((s for s in nearby if s["type"] == "police"), None)
    nearest_fire = next((s for s in nearby if s["type"] == "fire"), None)

    alert = {
        "status": "simulated",
        "message": f"EMERGENCY ALERT from {user_name}",
        "location": {"lat": lat, "lng": lng},
        "type": alert_type,
        "timestamp": None,  # filled by caller
        "notified": [],
    }

    if nearest_hospital:
        alert["notified"].append({
            "service": nearest_hospital["name"],
            "type": "hospital",
            "phone": nearest_hospital.get("phone", ""),
            "distance_km": nearest_hospital["distance_km"],
        })
    if nearest_police:
        alert["notified"].append({
            "service": nearest_police["name"],
            "type": "police",
            "phone": nearest_police.get("phone", ""),
            "distance_km": nearest_police["distance_km"],
        })
    if nearest_fire:
        alert["notified"].append({
            "service": nearest_fire["name"],
            "type": "fire",
            "phone": nearest_fire.get("phone", ""),
            "distance_km": nearest_fire["distance_km"],
        })

    return alert
