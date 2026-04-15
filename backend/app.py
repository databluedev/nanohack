"""SafeWindow FastAPI backend — serves API + static frontend."""
from __future__ import annotations
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from blackspots import CHENNAI_BLACKSPOTS
from risk_engine import (
    assess_route, risk_window, segment_risks, polyline_length_km
)
from routing import fetch_routes

ROOT = Path(__file__).parent.parent
WEB_DIR = ROOT / "web"

app = FastAPI(title="SafeWindow API", version="0.1.0")

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

@app.post("/api/route")
async def route(req: RouteReq):
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

@app.get("/")
def root():
    return {"service": "SafeWindow API", "frontend": "http://localhost:3000"}
