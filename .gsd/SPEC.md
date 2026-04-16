# SafeRoute AI — Product Specification

**Status:** FINALIZED
**Version:** 1.0
**Last Updated:** 2026-04-15

---

## Vision

SafeRoute AI transforms navigation from fastest-path optimization to intelligent safety-driven decision making. Unlike Google Maps, this system predicts road risk, suggests safer timing, warns proactively, and handles emergencies.

## Problem Statement

Traditional navigation apps optimize for speed/distance. They ignore:
- Historical accident patterns at specific locations
- Time-of-day risk variation (night vs morning)
- Weather-conditioned risk (rain, fog, visibility)
- Emergency response when incidents occur
- Proactive hazard prediction

## Target Users

| Segment | Need |
|---------|------|
| Daily commuters | Risk awareness for routine routes |
| Two-wheeler riders | Higher vulnerability, need safer routes |
| Delivery drivers | Frequent travel, risk exposure |
| Cab drivers | Passenger safety responsibility |
| Logistics companies | Fleet safety optimization |

## Core Features (Prioritized)

### Phase 0 — MVP (DONE)
- [x] Route risk comparison (multiple routes, scored 0-100)
- [x] Risk heatmap overlay (color-coded segments)
- [x] Time & weather simulation (departure hour + weather dropdown)
- [x] Risk Window (6-hour forecast, best departure slot)
- [x] In-trip voice co-pilot (Web Speech API alerts at 600m)
- [x] Trip safety receipt (hazards crossed, final score)
- [x] 15 Chennai black spots with conditional spikes
- [x] OSRM routing with Bezier fallback

### Phase 1 — Emergency Response Layer (CURRENT)
- [ ] Emergency SOS button (tap or voice-triggered)
- [ ] Nearest emergency services (hospitals, police, fire — Overpass API)
- [ ] Voice confirmation flow ("Emergency" → confirm → alert)
- [ ] Danger Mode (auto high-alert when risk > threshold)
- [ ] Predictive hazard alerts (fog/slippery logic)

### Phase 2 — Real-Time Intelligence
- [ ] Live weather API (Open-Meteo, free)
- [ ] Real GPS tracking (Geolocation API)
- [ ] Dynamic risk change during trip
- [ ] Junction-level risk highlights

### Phase 3 — UX & Data Enhancements
- [ ] Route Risk Memory (past trips)
- [ ] Risk Reason Tags per zone
- [ ] Safe Zones overlay
- [ ] Smart Route Recommendation (fastest/balanced/safest)
- [ ] Area Risk Score (city view)
- [ ] Community reporting (potholes, blind turns)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 + React 19 + TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Map | Leaflet 1.9 + CARTO dark tiles |
| Backend | FastAPI + Uvicorn (Python 3.12) |
| Routing | OSRM public API + Bezier fallback |
| Voice | Web Speech API (browser native) |
| Haptics | Vibration API |

## Non-Functional Requirements

- Localhost-first (no cloud dependency for demo)
- Sub-2s route computation
- Mobile-responsive (92vw constraint)
- Zero console errors
- Graceful degradation (OSRM fallback, voice fallback)

## Success Metrics

- Risk score spread across 0-100 (not saturating)
- Voice alerts fire reliably within 600m
- Emergency flow completes in < 3 taps
- All features demo-able without network (except OSRM/Overpass)
