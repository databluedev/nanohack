# SafeWindow — Chennai Risk Co-Pilot

> **Theme:** Smart Mobility & Safety
> **Tagline:** *It's not just where you drive — it's when.*

A risk-aware route planner for Chennai that surfaces accident-history patterns conditioned on **time × weather × day**. Instead of the usual static red/yellow/green heatmap, SafeWindow tells a driver:

- Which route has the lowest accident risk *right now*
- If waiting 30–90 minutes would significantly drop that risk
- A calm, proactive voice heads-up before each known danger zone during the drive
- A post-trip receipt summarizing the hazards encountered

Built end-to-end as a Next.js + FastAPI app running on localhost.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture](#architecture)
3. [Project Layout](#project-layout)
4. [Backend](#backend)
5. [Frontend](#frontend)
6. [Risk Engine — How It Works](#risk-engine--how-it-works)
7. [API Reference](#api-reference)
8. [Development Workflow](#development-workflow)
9. [Extending the System](#extending-the-system)
10. [Troubleshooting](#troubleshooting)
11. [Roadmap](#roadmap)

---

## Quick Start

### Prerequisites

- **Python 3.11+** (tested on 3.14)
- **Node.js 20.9+** (tested on 25.x)
- **npm 10+**
- Internet access (for OSRM public routing server + OSM tile CDN)

### 1. Clone & install backend

```bash
git clone https://github.com/databluedev/nanohack.git
cd nanohack/backend

python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### 2. Install frontend

```bash
cd ../web
npm install
```

### 3. Run both servers

Open two terminals.

**Terminal A — backend (port 8000):**
```bash
cd backend
.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8000
```

**Terminal B — frontend (port 3000):**
```bash
cd web
npm run dev
```

Open **http://localhost:3000**. That's it.

> Frontend proxies `/api/*` → `http://127.0.0.1:8000/api/*` via Next.js rewrites, so you never hit CORS issues in the browser.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Browser (localhost:3000)                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Next.js 16 + React 19 + Tailwind v4 + shadcn/ui       │  │
│  │  • Leaflet map (dark CARTO tiles + OSM)                │  │
│  │  • Plan / Drive / Receipt stage machine                │  │
│  │  • Web Speech API (voice warnings)                     │  │
│  │  • Vibration API (mobile haptic)                       │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │ /api/* (Next.js rewrite)         │
└───────────────────────────┼──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│  FastAPI backend (127.0.0.1:8000)                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  risk_engine.py  — scoring (conditional multipliers)   │  │
│  │  blackspots.py   — 15 curated Chennai black spots      │  │
│  │  routing.py      — OSRM client + bezier fallback       │  │
│  │  app.py          — 4 REST endpoints                    │  │
│  └────────────┬────────────────────┬──────────────────────┘  │
│               │                    │                         │
└───────────────┼────────────────────┼─────────────────────────┘
                │                    │
                ▼                    ▼
     OSRM public API          (future) OpenWeatherMap /
     router.project-osrm.org  Overpass / crowdsourced feed
```

---

## Project Layout

```
nanohack/
├── backend/
│   ├── app.py                  # FastAPI app + route handlers
│   ├── blackspots.py           # 15 Chennai black spots (coords + risk metadata)
│   ├── risk_engine.py          # Scoring engine (pure Python, no ML)
│   ├── routing.py              # OSRM client with fallback interpolator
│   ├── requirements.txt
│   └── .venv/                  # (gitignored) local venv
│
├── web/
│   ├── app/
│   │   ├── layout.tsx          # Root layout (dark mode forced, Leaflet CSS)
│   │   ├── page.tsx            # Stage machine: plan → drive → receipt
│   │   └── globals.css         # Tailwind v4 + shadcn variables
│   ├── components/
│   │   ├── MapView.tsx         # Leaflet map (client-only, dynamic import)
│   │   ├── PlanPanel.tsx       # Pre-trip UI: route picker + risk window
│   │   ├── DrivePanel.tsx      # In-trip UI: progress + hazard list
│   │   ├── ReceiptPanel.tsx    # Post-trip summary
│   │   ├── VoiceBanner.tsx     # Top-screen alert banner
│   │   ├── RiskBadge.tsx       # LOW/MED/HIGH chip
│   │   └── ui/                 # shadcn primitives
│   ├── lib/
│   │   ├── api.ts              # Typed fetch client for backend
│   │   ├── presets.ts          # 11 Chennai locations (dropdown source)
│   │   ├── types.ts            # Shared TS schemas
│   │   └── utils.ts            # shadcn `cn()` helper
│   ├── next.config.ts          # /api rewrite + allowedDevOrigins
│   ├── tsconfig.json
│   └── package.json
│
├── .gitignore
├── Theme.txt                   # Hackathon theme anchor
└── README.md                   # You are here
```

---

## Backend

### Stack

- **FastAPI** + **Uvicorn** (ASGI)
- **httpx** for OSRM calls (async)
- **pydantic v2** for request/response schemas
- **No database** — everything is in-memory or pre-computed

### Modules

#### `blackspots.py` — curated Chennai hazard list

15 accident black spots with:
- `name`, `lat`, `lng`
- `base` risk weight (0–100)
- `spikes`: conditional multipliers keyed by `morning`, `evening`, `night`, `rain`, `weekend`
- `voice`: the line the co-pilot speaks when approaching

Covers Kathipara Cloverleaf, Maduravoyal, Koyambedu, Tambaram, Pallavaram, T Nagar, Velachery, OMR-Thoraipakkam, GST Road-Chromepet, Anna Salai, Adyar Signal, Saidapet Bridge, Vadapalani, Guindy, Porur Junction.

#### `risk_engine.py` — the IP

Pure Python scoring. Key functions:

- `haversine_m(a_lat, a_lng, b_lat, b_lng)` — great-circle distance in meters
- `find_nearby_spots(polyline, radius_m=600)` — returns every black spot within radius of any point on the route
- `conditional_spike(spot, window, weather, day_type)` — multiplies base by time/weather/weekend spikes
- `assess_route(polyline, departure, weather)` — the main scorer. Returns:
  - `total_risk` (0–100, logistic soft-cap)
  - `background_risk` (length-based baseline)
  - `spot_risk` (black-spot contribution)
  - `waypoints` — sorted list of hazard details
- `segment_risks(polyline, waypoints)` — splits the polyline into ~20 segments each tagged `low` / `medium` / `high` for map coloring
- `risk_window(polyline, base_dt, weather_now, horizon_hours=6, step_min=30)` — returns risk score for each future departure slot; powers the time-slider

Saturation model: `total_norm = 100 × total / (total + K)` with K=30 to keep values spread across 0–100 instead of flat-lining at 100.

#### `routing.py` — OSRM + fallback

- `fetch_routes()` hits OSRM public demo (`router.project-osrm.org`) with `alternatives=true` for up to 2 candidate routes
- If OSRM is rate-limited or down, falls back to a quadratic-bezier interpolated polyline with a slight perpendicular bend (so demo never dies)

#### `app.py` — HTTP layer

FastAPI app with CORS wide-open (for dev). 4 endpoints documented below.

---

## Frontend

### Stack

- **Next.js 16** (App Router, Turbopack dev)
- **React 19**
- **TypeScript 5** strict
- **Tailwind CSS v4** (native CSS variables, no tailwind.config.js)
- **shadcn/ui** on Base UI primitives — Button, Card, Select, Input, Label, Badge, Progress
- **Leaflet 1.9** with CARTO dark tiles
- Native Web APIs: `SpeechSynthesis`, `Vibration`, `Geolocation` (reserved for future)

### Stage Machine

`app/page.tsx` holds a single `stage` state: `"plan" | "drive" | "receipt"`.

```
[plan] ──(pick route, hit Start)──▶ [drive] ──(polyline finished)──▶ [receipt]
  ▲                                                                      │
  └──────────────────────(New Trip)─────────────────────────────────────┘
```

All stages share the same `<MapView>` component — only the right-side panel swaps.

### Map rendering rules

- Primary route: thick stroke (weight 6), opacity 0.95
- Alternative routes: thin stroke (weight 4), opacity 0.4
- Segment color by level: `#10b981` (low) / `#f59e0b` (medium) / `#dc2626` (high)
- Black-spot markers: pulsing red divIcon with box-shadow ring
- Driver: blue circle marker that pans with the viewport

### Voice UX

When the driver enters a 600m radius of a black spot:
1. Warning text appears as a top-screen banner for 5s
2. `speechSynthesis.speak()` reads the line aloud
3. `navigator.vibrate([80, 40, 80])` fires on mobile
4. The spot is added to an `announcedRef` set so it never repeats

Any spot can be overridden by calling the same function — the TTS queue is cancelled before each new utterance to avoid pile-up.

---

## Risk Engine — How It Works

For each candidate route polyline, at a given departure datetime and weather:

```
  base_mult  = time_multiplier(window) × weather_multiplier(w) × day_multiplier(day)

  FOR EACH black spot within 600m of polyline:
    proximity_factor = max(0.3, 1 - distance_m / 600)
    spike            = conditional_spike(spot, window, weather, day)
    score            = spot.base × proximity × base_mult × spike / 100
    spot_risk_sum   += score

  length_km   = haversine length of polyline
  background  = length_km × 0.25 × base_mult        (per-km structural floor)
  total       = spot_risk_sum + background
  total_norm  = 100 × total / (total + 30)          (logistic soft-cap)
```

Multipliers:

| Factor | Values |
|---|---|
| Time window | morning 1.3 · midday 0.9 · evening 1.5 · night 1.4 · late-night 1.1 |
| Weather | clear 1.0 · cloudy 1.05 · rain 1.6 · heavy_rain 1.9 · fog 1.7 |
| Day type | weekday 1.0 · weekend 1.15 · holiday 1.2 · festival 1.3 |

Per-spot spikes are defined in `blackspots.py` and stack **on top** of the global multipliers (e.g. Velachery × 1.8 in rain, applied after the global rain × 1.6).

---

## API Reference

All endpoints return JSON. Base URL during dev: `http://127.0.0.1:8000`.

### `GET /api/health`

Liveness probe.

```json
{ "ok": true, "blackspots": 15 }
```

### `GET /api/blackspots`

Full list of curated hazard points (for admin/debug).

### `POST /api/route`

Compute 1–3 alternative routes and score each.

**Request body:**
```json
{
  "from_lat": 13.0827, "from_lng": 80.2707,
  "to_lat":   12.9249, "to_lng":   80.1000,
  "departure": "2026-04-15T18:00:00",   // naive local ISO (preferred)
  "weather":   "rain",                  // clear|cloudy|rain|heavy_rain|fog
  "alternatives": 2
}
```

**Response (abridged):**
```json
{
  "count": 1,
  "routes": [{
    "id": "r0",
    "polyline": [[13.08, 80.27], [13.07, 80.26], ...],
    "distance_m": 33940,
    "duration_s": 1745,
    "source": "osrm",
    "recommended": true,
    "assessment": {
      "total_risk": 49.8,
      "spot_risk": 37.1,
      "background_risk": 18.4,
      "length_km": 33.94,
      "context": { "time_window": "evening", "day_type": "weekday",
                   "weather": "rain", "departure": "..." },
      "waypoints": [
        { "name": "Velachery", "lat": ..., "lng": ...,
          "score": 4.54, "distance_m": 240.1,
          "voice": "...", "nearest_idx": 312 },
        ...
      ]
    },
    "segments": [
      { "polyline": [[...], [...]], "score": 4.5, "level": "high" },
      ...
    ]
  }]
}
```

Routes are returned sorted ascending by `total_risk`; the first is marked `recommended: true`.

### `POST /api/assess`

Score an arbitrary polyline without routing.

```json
{ "polyline": [[lat, lng], ...], "departure": "...", "weather": "clear" }
```

### `POST /api/window`

Risk forecast for future departure slots. Powers the time-slider.

```json
{
  "polyline": [[lat, lng], ...],
  "weather": "rain",
  "base":    "2026-04-15T18:00:00",
  "horizon_hours": 6,
  "step_min":      30
}
```

**Response:**
```json
{
  "slots": [
    { "time": "...", "label": "18:00", "risk": 49.8, "weather": "rain" },
    ...
  ],
  "best_slot": { "time": "...", "label": "22:30", "risk": 27.1, "weather": "clear" },
  "saving_pct": 45.6
}
```

---

## Development Workflow

### Running dev

See [Quick Start](#quick-start). Both servers hot-reload on save.

### Type-check the frontend

```bash
cd web
npx tsc --noEmit
```

### Inspect API manually

```bash
curl -s http://127.0.0.1:8000/api/health
curl -s -X POST http://127.0.0.1:8000/api/route \
  -H "content-type: application/json" \
  -d '{"from_lat":13.0827,"from_lng":80.2707,"to_lat":12.9249,"to_lng":80.1000,"weather":"rain","departure":"2026-04-15T18:00:00","alternatives":2}'
```

### Smoke-test the risk engine

```bash
cd backend
.venv/bin/python -c "
from datetime import datetime
from risk_engine import assess_route
poly = [(13.0827,80.2707),(13.0418,80.2341),(12.9815,80.218),(12.9249,80.1)]
print(assess_route(poly, datetime(2026,4,15,18,30), 'rain'))
"
```

### Conventions

- **No secrets in code** — use env vars when we add real API keys (OpenWeatherMap, etc.)
- **Frontend sends naive-local ISO timestamps** to the backend (no `Z` suffix). This keeps clock labels in user-local time without timezone roundtrips.
- **Backend is stateless** — safe to scale horizontally when we add real deployment
- **Map is a pluggable canvas** — `MapView.tsx` could swap Leaflet for Google Maps or Mapbox without touching risk logic

---

## Extending the System

### Add a new Chennai location preset

Edit `web/lib/presets.ts`:

```ts
{ name: "My New Place", lat: 13.1, lng: 80.2 }
```

### Add a new black spot

Edit `backend/blackspots.py` and append:

```python
{
  "name": "My Junction",
  "lat": 13.X, "lng": 80.X,
  "base": 75,
  "spikes": {"evening": 1.5, "rain": 1.7},
  "voice": "My junction ahead. ..."
}
```

No backend restart needed if you kill + rerun uvicorn.

### Tune a multiplier

Edit `backend/risk_engine.py` — constants live in `time_multiplier()`, `weather_multiplier()`, `day_multiplier()`.

### Wire real weather

Replace the dropdown in `PlanPanel.tsx` with a call to Open-Meteo (no key required):

```ts
const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=weather_code,precipitation`);
```

Map `weather_code` → our 5-value enum.

### Swap the map canvas

Only `components/MapView.tsx` touches Leaflet. To move to Mapbox, rewrite that one file — every other component just passes `routes`/`driverPos` props.

### Add real GPS

Replace the step interval in `DrivePanel.tsx`:

```ts
navigator.geolocation.watchPosition(pos => setPos([pos.coords.latitude, pos.coords.longitude]));
```

Keep the proximity check unchanged.

---

## Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| `pip install` fails building `pydantic-core` | Python 3.14 + pinned wheel mismatch. `requirements.txt` is already unpinned; delete `.venv` and reinstall. |
| OSRM returns 429 or times out | Public demo is rate-limited. The `routing.py` fallback auto-kicks in — you'll see `source: "fallback"` on the route. |
| Select shows "0" or "5" instead of place name | Means you regressed the `SelectValue>{(v) => labelFor(v)}</SelectValue>` render-function. Base UI Select needs a function child to map values → labels. |
| Time slider labels are 5–6 hours off | Backend is parsing a UTC ISO string but rendering naive. Frontend must send naive-local ISO, never `.toISOString()`. |
| `Blocked cross-origin request` in dev logs | Add your host to `allowedDevOrigins` in `next.config.ts`. |
| Voice doesn't play on iOS | Safari requires a user gesture before `speechSynthesis.speak()` — add a "tap to enable sound" step on first visit. |
| Map tiles never load | CARTO tile CDN is blocked. Swap `web/components/MapView.tsx` to use stock OSM tiles. |

---

## Roadmap

| Priority | Item |
|---|---|
| P0 | Real weather via Open-Meteo (no key) |
| P0 | Replace hand-curated weights with ingested accident data (Chennai-specific) |
| P1 | Real GPS tracking (`navigator.geolocation.watchPosition`) instead of simulation |
| P1 | OpenStreetMap structural risk layer (junctions, schools, lighting) via Overpass |
| P2 | PWA manifest + service worker for "Add to Home Screen" |
| P2 | Crowdsourced near-miss tap button + ingestion endpoint |
| P2 | Post-trip trip log persistence (IndexedDB) |
| P3 | Multi-city support (abstract the blackspots and presets per city) |
| P3 | Admin dashboard for partners (insurers, fleet, traffic police) |

---

## License

TBD before public release. Default recommendation: **MIT**.

---

*Built for a nano-hackathon under the theme **Smart Mobility & Safety**.*
