# SafeWindow — Chennai Risk Co-Pilot

> **Theme:** Smart Mobility & Safety  
> **Tagline:** *It's not just where you drive — it's when.*

SafeWindow is a **real-time, risk-aware route planner for Chennai** that tells drivers the safest time and route to travel. It combines accident blackspot data with live weather, time-of-day patterns, and traffic congestion to produce dynamic risk scores — not static heatmaps.

**What makes it different:**
- Tells you which route has the lowest accident risk *right now*
- Suggests if waiting 30–90 min would significantly reduce danger
- Delivers calm voice warnings before each known danger zone
- Provides a post-trip safety receipt with hazards encountered

---

## Screenshots

| Plan Your Route | Drive Mode | Safety Receipt |
|:---:|:---:|:---:|
| Pick origin/destination, see risk scores per route, slide through departure times | Voice alerts, hazard proximity, turn-by-turn navigation | Post-trip summary of hazards encountered and safety score |

---

## Key Features

| Feature | Description |
|---|---|
| **Risk-Scored Routes** | Up to 3 alternative routes scored 0–100 based on blackspot proximity, weather, time, and traffic |
| **Time-Window Optimizer** | 6-hour forecast showing risk at every 30-min departure slot — find the safest window |
| **Live Voice Warnings** | Text-to-speech alerts + haptic vibration when approaching a blackspot (600m radius) |
| **Turn-by-Turn Navigation** | OSRM-powered step-by-step directions with maneuver icons |
| **Women's Safety Mode** | Routes scored with police proximity bonus + night-time penalty |
| **Traffic Congestion Layer** | 10 real Chennai corridors with time-of-day congestion patterns |
| **Emergency Services Finder** | Nearby hospitals, police stations, fire stations via OpenStreetMap |
| **Community Reports** | Crowdsourced hazard reports (potholes, waterlogging, accidents) with time-decay TTL |
| **Driver Safety Score** | Gamified tracking — safe trips, hazards avoided, percentile ranking |
| **Crash Detection** | Simulated impact detection with 10-second countdown + auto-emergency trigger |
| **Trip Sharing** | Share live trip link with family for real-time safety monitoring |
| **Safe Destinations** | Find fuel, parking, food, hotels in low-risk zones |
| **Risk Explainer** | Detailed breakdown of every factor contributing to a route's risk score |
| **Area Risk Grid** | Heatmap overlay showing blackspot density across Chennai |
| **Smart Notifications** | Alerts when current conditions are worse than baseline |

---

## Tech Stack

### Backend (Python)
- **FastAPI** + **Uvicorn** — async ASGI web framework
- **Pydantic v2** — request/response validation
- **httpx** — async HTTP client for external APIs
- Pure Python risk engine (no ML libraries needed)

### Frontend (JavaScript/TypeScript)
- **Next.js 16** (React 19, App Router, Turbopack)
- **TypeScript 5** (strict mode)
- **Tailwind CSS v4** + **shadcn/ui** components
- **Leaflet 1.9** — interactive map with CARTO dark tiles
- **Web Speech API** — voice warnings
- **Vibration API** — mobile haptic feedback

### External Services (All Free, No API Keys Required)
- **OSRM** — open-source routing with turn-by-turn directions
- **Open-Meteo** — live weather data (WMO codes)
- **Overpass API** — OpenStreetMap POI queries (hospitals, police, etc.)
- **CARTO CDN** — dark-themed map tiles

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (localhost:3000)                                │
│  Next.js 16 + React 19 + Leaflet Map                    │
│  Stage Machine: [Plan] → [Drive] → [Receipt]            │
│  Voice Alerts · Haptic · GPS-ready                       │
└──────────────────────┬──────────────────────────────────┘
                       │  /api/* (Next.js rewrite proxy)
┌──────────────────────▼──────────────────────────────────┐
│  FastAPI Backend (port 8000)                              │
│  ┌─────────────┐  ┌────────────┐  ┌──────────────────┐  │
│  │ Risk Engine  │  │ 25 Chennai │  │ OSRM + Bezier    │  │
│  │ (scoring)    │  │ Blackspots │  │ Routing          │  │
│  └──────┬──────┘  └────────────┘  └──────┬───────────┘  │
│         │                                 │              │
└─────────┼─────────────────────────────────┼──────────────┘
          ▼                                 ▼
   Open-Meteo API                    OSRM Public API
   Overpass API                      (+ fallback routing)
```

---

## Risk Engine — How It Works

SafeWindow uses a **deterministic, rule-based scoring system** — fully explainable, no black-box ML.

```
Risk Score = 100 × total / (total + 30)     ← logistic soft-cap (0–100)

WHERE total = spot_risk + background_risk

FOR EACH blackspot within 600m of route:
  proximity  = max(0.3, 1 - distance / 600m)
  spike      = conditional_spike(spot, time, weather, day)
  spot_score = base_risk × proximity × multipliers × spike

Multipliers:
  TIME:    morning(1.3) · midday(0.9) · evening(1.5) · night(1.4) · late-night(1.1)
  WEATHER: clear(1.0) · cloudy(1.05) · rain(1.6) · heavy_rain(1.9) · fog(1.7)
  DAY:     weekday(1.0) · weekend(1.15) · holiday(1.2) · festival(1.3)
```

**25 curated Chennai blackspots** including Kathipara Cloverleaf, Maduravoyal, Koyambedu, OMR-Thoraipakkam, Velachery, and more — each with per-spot conditional spikes (e.g., Velachery ×1.8 in rain).

---

## Quick Start

### Prerequisites
- Python 3.11+ and Node.js 20.9+
- Internet access (for OSRM routing + map tiles)

### Install & Run

```bash
# Clone
git clone https://github.com/databluedev/nanohack.git
cd nanohack

# Backend
cd backend
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8000

# Frontend (new terminal)
cd web
npm install
npm run dev
```

Open **http://localhost:3000** — that's it.

---

## Project Structure

```
nanohack/
├── backend/
│   ├── app.py              # FastAPI endpoints (route, assess, window, emergency, etc.)
│   ├── risk_engine.py      # Scoring engine (pure Python)
│   ├── blackspots.py       # 25 Chennai accident blackspots with metadata
│   ├── routing.py          # OSRM client + Bezier fallback
│   ├── weather.py          # Open-Meteo live weather integration
│   ├── emergency.py        # Nearby services via Overpass API
│   ├── traffic.py          # Congestion model (10 Chennai corridors)
│   ├── destinations.py     # Safe destination finder
│   └── requirements.txt
│
├── web/
│   ├── app/
│   │   ├── page.tsx        # Main stage machine (plan → drive → receipt)
│   │   ├── layout.tsx      # Root layout
│   │   └── globals.css     # Tailwind + theme variables
│   ├── components/
│   │   ├── MapView.tsx     # Leaflet map (dark CARTO tiles)
│   │   ├── PlanPanel.tsx   # Route planning UI
│   │   ├── DrivePanel.tsx  # Drive simulation + voice alerts
│   │   ├── ReceiptPanel.tsx        # Post-trip summary
│   │   ├── VoiceBanner.tsx         # Alert banner
│   │   ├── EmergencyPanel.tsx      # Nearby emergency services
│   │   ├── CrashDetector.tsx       # Crash detection + countdown
│   │   ├── RiskExplainer.tsx       # Risk factor breakdown
│   │   ├── DriverScoreCard.tsx     # Safety score gamification
│   │   ├── SafeDestinations.tsx    # Low-risk amenity finder
│   │   └── ui/                     # shadcn primitives
│   ├── lib/
│   │   ├── api.ts          # Typed fetch client
│   │   ├── presets.ts      # 25 Chennai location presets
│   │   ├── driverScore.ts  # Score tracking logic
│   │   └── types.ts        # Shared TypeScript types
│   └── next.config.ts
│
└── README.md
```

---

## AI Tools Used

- **Claude AI (Anthropic)** — AI-assisted development for code generation, architecture design, risk engine logic, and feature implementation across all phases
- **Claude Code CLI** — Used as the primary development copilot for iterative building, debugging, and code review

---

## Team

Built for **NanoHack** under the theme **Smart Mobility & Safety**.

---

## License

MIT
