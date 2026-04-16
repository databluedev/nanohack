"""SafeRoute AI FastAPI backend — serves API + static frontend."""
from __future__ import annotations
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple, Dict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from blackspots import CHENNAI_BLACKSPOTS, CHENNAI_SAFE_ZONES
from risk_engine import (
    assess_route, risk_window, segment_risks, polyline_length_km, haversine_m
)
from routing import fetch_routes
from emergency import (
    find_nearby_services, find_nearby_services_overpass, simulate_alert
)
from weather import fetch_live_weather

ROOT = Path(__file__).parent.parent
WEB_DIR = ROOT / "web"

app = FastAPI(title="SafeRoute AI API", version="0.2.0")

# Community reports file (persistent across restarts)
REPORTS_FILE = Path(__file__).parent / "community_reports.json"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Schemas ----------
class RouteReq(BaseModel):
    from_lat: float; from_lng: float
    to_lat: float; to_lng: float
    departure: Optional[str] = None  # ISO; default = now
    weather: str = "clear"
    alternatives: int = 2

class AssessReq(BaseModel):
    polyline: List[Tuple[float, float]]
    departure: Optional[str] = None
    weather: str = "clear"

class WindowReq(BaseModel):
    polyline: List[Tuple[float, float]]
    weather: str = "clear"
    horizon_hours: int = 6
    step_min: int = 30
    base: Optional[str] = None  # ISO

class EmergencyNearbyReq(BaseModel):
    lat: float
    lng: float
    radius_m: float = 5000.0
    service_type: Optional[str] = None  # hospital, police, fire, or None for all

class EmergencyAlertReq(BaseModel):
    lat: float
    lng: float
    user_name: str = "Driver"
    alert_type: str = "accident"  # accident, medical, fire, other

class WeatherReq(BaseModel):
    lat: float = 13.05
    lng: float = 80.22

class CommunityReportReq(BaseModel):
    lat: float
    lng: float
    report_type: str  # pothole, blind_turn, accident_spot, waterlogging, construction, other
    description: str = ""
    severity: int = 2  # 1-3

class AreaRiskReq(BaseModel):
    lat: float = 13.05
    lng: float = 80.22
    radius_km: float = 8.0

# ---------- Helpers ----------
def parse_dt(s: Optional[str]) -> datetime:
    if not s:
        return datetime.now()
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return datetime.now()

# ---------- API ----------
@app.get("/api/health")
def health():
    return {"ok": True, "blackspots": len(CHENNAI_BLACKSPOTS)}

@app.get("/api/blackspots")
def blackspots():
    return {"spots": CHENNAI_BLACKSPOTS}

@app.post("/api/assess")
def assess(req: AssessReq):
    departure = parse_dt(req.departure)
    a = assess_route(req.polyline, departure, req.weather)
    segs = segment_risks(req.polyline, a["waypoints"])
    return {"assessment": a, "segments": segs}

@app.post("/api/window")
def window(req: WindowReq):
    base = parse_dt(req.base)
    slots = risk_window(req.polyline, base, req.weather, req.horizon_hours, req.step_min)
    # Find best slot
    best = min(slots, key=lambda s: s["risk"]) if slots else None
    now_risk = slots[0]["risk"] if slots else 0
    saving = round(((now_risk - best["risk"]) / now_risk * 100) if best and now_risk > 0 else 0, 1)
    return {
        "slots": slots,
        "best_slot": best,
        "saving_pct": saving,
    }

@app.post("/api/route")
async def route_with_mode(req: RouteReq):
    """Get routes with optional route_mode priority (fastest/balanced/safest)."""
    routes = await fetch_routes(
        req.from_lat, req.from_lng, req.to_lat, req.to_lng, req.alternatives
    )
    if not routes:
        raise HTTPException(503, "No route found")
    departure = parse_dt(req.departure)

    enriched = []
    for r in routes:
        a = assess_route(r["polyline"], departure, req.weather)
        segs = segment_risks(r["polyline"], a["waypoints"])
        enriched.append({
            **r,
            "assessment": a,
            "segments": segs,
        })

    # Sort by risk (lowest first = recommended)
    enriched.sort(key=lambda x: x["assessment"]["total_risk"])
    if enriched:
        enriched[0]["recommended"] = True

    return {"routes": enriched, "count": len(enriched)}

# ---- Weather ----
@app.post("/api/weather")
async def weather_endpoint(req: WeatherReq):
    return await fetch_live_weather(req.lat, req.lng)

@app.get("/api/weather/chennai")
async def weather_chennai():
    """Quick weather for Chennai center."""
    return await fetch_live_weather(13.05, 80.22)

# ---- Safe Zones ----
@app.get("/api/safezones")
def safe_zones():
    return {"zones": CHENNAI_SAFE_ZONES, "count": len(CHENNAI_SAFE_ZONES)}

# ---- Area Risk Score ----
@app.post("/api/area-risk")
def area_risk(req: AreaRiskReq):
    """Compute area-level risk for a grid of cells around a center point."""
    grid_size = 5  # 5x5 grid
    step_lat = req.radius_km / 111.0 / (grid_size / 2)  # ~111 km per degree lat
    step_lng = step_lat / 0.9  # rough correction for longitude at 13°N

    cells = []
    for row in range(grid_size):
        for col in range(grid_size):
            cell_lat = req.lat + (row - grid_size // 2) * step_lat
            cell_lng = req.lng + (col - grid_size // 2) * step_lng
            # Count blackspots near this cell
            spot_score = 0.0
            spot_count = 0
            for spot in CHENNAI_BLACKSPOTS:
                d = haversine_m(cell_lat, cell_lng, spot["lat"], spot["lng"])
                if d < req.radius_km * 1000 / grid_size * 1.5:
                    spot_score += spot["base"] * max(0.1, 1.0 - d / 3000.0)
                    spot_count += 1
            # Normalize 0-100
            norm = min(100, spot_score * 2)
            level = "high" if norm >= 60 else "medium" if norm >= 25 else "low"
            cells.append({
                "lat": round(cell_lat, 5),
                "lng": round(cell_lng, 5),
                "score": round(norm, 1),
                "level": level,
                "spots_nearby": spot_count,
            })

    return {"cells": cells, "grid_size": grid_size, "center": {"lat": req.lat, "lng": req.lng}}

# ---- Community Reports ----
def _load_reports() -> List[Dict]:
    if REPORTS_FILE.exists():
        try:
            return json.loads(REPORTS_FILE.read_text())
        except Exception:
            return []
    return []

def _save_reports(reports: List[Dict]):
    REPORTS_FILE.write_text(json.dumps(reports, indent=2))

@app.get("/api/community/reports")
def get_reports():
    return {"reports": _load_reports()}

@app.post("/api/community/report")
def add_report(req: CommunityReportReq):
    reports = _load_reports()
    report = {
        "id": len(reports) + 1,
        "lat": req.lat,
        "lng": req.lng,
        "type": req.report_type,
        "description": req.description,
        "severity": req.severity,
        "timestamp": datetime.now().isoformat(),
        "upvotes": 0,
    }
    reports.append(report)
    _save_reports(reports)
    return report

@app.post("/api/community/upvote/{report_id}")
def upvote_report(report_id: int):
    reports = _load_reports()
    for r in reports:
        if r["id"] == report_id:
            r["upvotes"] = r.get("upvotes", 0) + 1
            _save_reports(reports)
            return r
    raise HTTPException(404, "Report not found")

# ---- Emergency ----
@app.post("/api/emergency/nearby")
async def emergency_nearby(req: EmergencyNearbyReq):
    services = await find_nearby_services_overpass(
        req.lat, req.lng, req.radius_m, req.service_type
    )
    return {
        "services": services,
        "count": len(services),
        "location": {"lat": req.lat, "lng": req.lng},
    }

@app.post("/api/emergency/alert")
def emergency_alert(req: EmergencyAlertReq):
    alert = simulate_alert(req.lat, req.lng, req.user_name, req.alert_type)
    alert["timestamp"] = datetime.now().isoformat()
    return alert

# ---- Trip Sessions (Family Safety) ----
TRIP_SESSIONS: Dict[str, Dict] = {}  # in-memory for demo

class TripSessionReq(BaseModel):
    trip_id: str
    from_name: str
    to_name: str
    polyline: List[Tuple[float, float]]
    weather: str = "clear"
    risk: float = 0
    driver_name: str = "Driver"

class TripUpdateReq(BaseModel):
    trip_id: str
    lat: float
    lng: float
    risk: float = 0
    pct: float = 0
    status: str = "driving"  # driving, stopped, arrived, emergency

@app.post("/api/trip/start")
def trip_start(req: TripSessionReq):
    import uuid
    share_id = str(uuid.uuid4())[:8]
    TRIP_SESSIONS[share_id] = {
        "trip_id": req.trip_id,
        "share_id": share_id,
        "from": req.from_name,
        "to": req.to_name,
        "driver": req.driver_name,
        "weather": req.weather,
        "risk": req.risk,
        "started_at": datetime.now().isoformat(),
        "last_update": datetime.now().isoformat(),
        "position": {"lat": req.polyline[0][0], "lng": req.polyline[0][1]} if req.polyline else None,
        "pct": 0,
        "status": "driving",
        "polyline": req.polyline[:200],  # limit for memory
    }
    return {"share_id": share_id, "share_url": f"/family/{share_id}"}

@app.post("/api/trip/update")
def trip_update(req: TripUpdateReq):
    for sid, session in TRIP_SESSIONS.items():
        if session["trip_id"] == req.trip_id:
            session["position"] = {"lat": req.lat, "lng": req.lng}
            session["risk"] = req.risk
            session["pct"] = req.pct
            session["status"] = req.status
            session["last_update"] = datetime.now().isoformat()
            return {"ok": True}
    return {"ok": False, "error": "Session not found"}

@app.get("/api/trip/family/{share_id}")
def trip_family(share_id: str):
    session = TRIP_SESSIONS.get(share_id)
    if not session:
        raise HTTPException(404, "Trip not found or expired")
    return session

# ---- Risk Explainer ----
@app.post("/api/risk/explain")
def risk_explain(req: AssessReq):
    """Rich explanation for each hazard along a route."""
    departure = parse_dt(req.departure)
    a = assess_route(req.polyline, departure, req.weather)

    explanations = []
    for w in a["waypoints"]:
        # Find the original blackspot data
        spot_data = None
        for s in CHENNAI_BLACKSPOTS:
            if s["name"] == w["name"]:
                spot_data = s
                break

        time_win = a["context"]["time_window"]
        day_type = a["context"]["day_type"]
        weather = a["context"]["weather"]

        factors = []
        if time_win in ("evening", "night"):
            factors.append(f"Evening/night hours increase accident probability by ~{int((1.5 - 1) * 100)}%")
        if time_win == "morning":
            factors.append("Morning rush: higher two-wheeler density and fatigue-related incidents")
        if weather in ("rain", "heavy_rain"):
            factors.append(f"Rain reduces visibility and traction — risk multiplied by ~{1.6 if weather == 'rain' else 1.9}x")
        if weather == "fog":
            factors.append("Fog drastically reduces visibility — risk multiplied by ~1.7x")
        if day_type == "weekend":
            factors.append("Weekend traffic patterns differ — more recreational vehicles")

        tags = spot_data.get("tags", []) if spot_data else w.get("tags", [])
        junction = spot_data.get("junction_type", "unknown") if spot_data else w.get("junction_type", "unknown")

        for tag in tags:
            if tag == "waterlogging":
                factors.append("Known waterlogging area — standing water in rain")
            elif tag == "overspeeding":
                factors.append("Common overspeeding zone — insufficient enforcement")
            elif tag == "low lighting":
                factors.append("Poor street lighting — reduced visibility after dark")
            elif tag == "school zone":
                factors.append("School zone — unpredictable pedestrian movement")
            elif tag == "two-wheeler zone":
                factors.append("High two-wheeler density — frequent weaving and lane changes")
            elif tag == "truck traffic":
                factors.append("Heavy goods vehicles — large blind spots, wide turns")

        advice = []
        if w["score"] > 5:
            advice.append("Reduce speed to 30 km/h or below")
        if junction in ("roundabout", "cloverleaf"):
            advice.append("Yield to traffic already in the roundabout")
        if junction in ("signal",):
            advice.append("Do not jump the signal even if road appears clear")
        if "rain" in weather:
            advice.append("Maintain 3-second following distance")
        if time_win in ("night", "latenight"):
            advice.append("Use high beam on stretches without oncoming traffic")
        advice.append("Stay alert and avoid distractions")

        explanations.append({
            "name": w["name"],
            "score": w["score"],
            "junction_type": junction,
            "tags": tags,
            "base_risk": spot_data["base"] if spot_data else 0,
            "contributing_factors": factors,
            "safety_advice": advice,
            "voice": w["voice"],
            "lat": w["lat"],
            "lng": w["lng"],
        })

    return {
        "explanations": explanations,
        "context": a["context"],
        "total_risk": a["total_risk"],
    }

# ---- Women's Safety Mode ----
@app.post("/api/route/safe")
async def route_safe_mode(req: RouteReq):
    """Routes optimized for women's safety — avoids poorly-lit areas, prefers police proximity."""
    routes = await fetch_routes(req.from_lat, req.from_lng, req.to_lat, req.to_lng, req.alternatives)
    if not routes:
        raise HTTPException(503, "No route found")
    departure = parse_dt(req.departure)

    from emergency import find_nearby_services

    enriched = []
    for r in routes:
        a = assess_route(r["polyline"], departure, req.weather)
        segs = segment_risks(r["polyline"], a["waypoints"])

        # Safety bonus: count police stations within 1km of route
        police_nearby = 0
        for pt in r["polyline"][::10]:  # sample every 10th point
            services = find_nearby_services(pt[0], pt[1], radius_m=1000, service_type="police")
            police_nearby += len(services)

        # Penalty for night + low-lighting tags
        night_penalty = 0
        if departure.hour >= 20 or departure.hour < 6:
            for w in a["waypoints"]:
                tags = w.get("tags", [])
                if "low lighting" in tags or "night risk" in tags:
                    night_penalty += 10

        safety_score = a["total_risk"] + night_penalty - (police_nearby * 2)

        enriched.append({
            **r,
            "assessment": a,
            "segments": segs,
            "safety_score": round(max(0, safety_score), 1),
            "police_nearby": police_nearby,
            "night_penalty": night_penalty,
        })

    enriched.sort(key=lambda x: x["safety_score"])
    if enriched:
        enriched[0]["recommended"] = True

    return {"routes": enriched, "count": len(enriched), "mode": "women_safety"}

def _build_notify_message(should_notify, pct_increase, best, best_saving):
    if not should_notify:
        return "Conditions are normal."
    msg = f"Today's conditions increase risk by {round(pct_increase)}%."
    if best and best_saving > 10:
        label = best.get("label", "later")
        msg += f" Leave at {label} to cut risk by {best_saving}%."
    return msg

# ---- Smart Notification Data ----
@app.post("/api/smart-notify")
async def smart_notify(req: RouteReq):
    """Check if conditions are worse than usual for a route."""
    departure = parse_dt(req.departure)
    routes = await fetch_routes(req.from_lat, req.from_lng, req.to_lat, req.to_lng, 1)
    if not routes:
        return {"should_notify": False}

    current_assessment = assess_route(routes[0]["polyline"], departure, req.weather)

    # Compare with clear-weather, midday baseline
    from datetime import datetime as dt
    baseline_time = departure.replace(hour=12)
    baseline_assessment = assess_route(routes[0]["polyline"], baseline_time, "clear")

    risk_increase = current_assessment["total_risk"] - baseline_assessment["total_risk"]
    pct_increase = (risk_increase / max(1, baseline_assessment["total_risk"])) * 100

    weather_data = await fetch_live_weather(req.from_lat, req.from_lng)

    # Find best time in next 4 hours
    from risk_engine import risk_window as rw
    slots = rw(routes[0]["polyline"], departure, req.weather, 4, 30)
    best = min(slots, key=lambda s: s["risk"]) if slots else None
    best_saving = round(((current_assessment["total_risk"] - best["risk"]) / max(1, current_assessment["total_risk"])) * 100) if best else 0

    should_notify = pct_increase > 20 or risk_increase > 10

    return {
        "should_notify": should_notify,
        "current_risk": current_assessment["total_risk"],
        "baseline_risk": baseline_assessment["total_risk"],
        "risk_increase": round(risk_increase, 1),
        "pct_increase": round(pct_increase, 1),
        "weather": weather_data,
        "best_slot": best,
        "best_saving_pct": best_saving,
        "message": _build_notify_message(should_notify, pct_increase, best, best_saving),
    }

@app.get("/")
def root():
    return {"service": "SafeRoute AI", "frontend": "http://localhost:3000"}
