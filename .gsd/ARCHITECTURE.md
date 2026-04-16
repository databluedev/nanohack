# SafeRoute AI — Architecture

## System Overview

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ MapView  │  │ Panels   │  │ Voice/Haptics │  │
│  │ (Leaflet)│  │ Plan/    │  │ Speech API    │  │
│  │          │  │ Drive/   │  │ Vibration API │  │
│  │          │  │ Receipt/ │  │ SpeechRecog.  │  │
│  │          │  │ Emergency│  │               │  │
│  └────┬─────┘  └────┬─────┘  └───────────────┘  │
│       │              │                            │
│       └──────┬───────┘                            │
│              │ fetch(/api/*)                      │
└──────────────┼────────────────────────────────────┘
               │ Next.js rewrite
┌──────────────┼────────────────────────────────────┐
│         FastAPI Backend (:8000)                    │
│  ┌───────────┐ ┌────────────┐ ┌────────────────┐  │
│  │ routing.py│ │risk_engine │ │ emergency.py   │  │
│  │ OSRM +   │ │ scoring +  │ │ Overpass API + │  │
│  │ fallback  │ │ multipliers│ │ alert simulate │  │
│  └───────────┘ └────────────┘ └────────────────┘  │
│                     │                              │
│              blackspots.py                         │
│              (15 curated spots)                    │
└────────────────────────────────────────────────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
  OSRM    Overpass    CARTO
  (routes) (POI)     (tiles)
```

## Key Files

### Backend (E:/Muzammil/nanohack/backend/)
| File | Purpose |
|------|---------|
| app.py | FastAPI app, all endpoints |
| blackspots.py | 15 Chennai accident hotspots |
| risk_engine.py | Scoring: haversine, multipliers, soft-cap |
| routing.py | OSRM client + Bezier fallback |
| emergency.py | Emergency services + alert simulation (NEW) |

### Frontend (E:/Muzammil/nanohack/web/)
| File | Purpose |
|------|---------|
| app/page.tsx | Stage machine orchestrator |
| components/MapView.tsx | Leaflet map wrapper |
| components/PlanPanel.tsx | Pre-trip planning UI |
| components/DrivePanel.tsx | In-trip co-pilot UI |
| components/ReceiptPanel.tsx | Post-trip summary |
| components/EmergencyButton.tsx | SOS trigger (NEW) |
| components/EmergencyPanel.tsx | Services + alert UI (NEW) |
| components/VoiceBanner.tsx | Top-screen alert banner |
| lib/api.ts | Typed backend client |
| lib/types.ts | TypeScript schemas |
| lib/presets.ts | 11 Chennai locations |

## Data Flow

1. User selects From/To/Weather/Hour → `POST /api/route`
2. Backend fetches OSRM routes → scores each via risk_engine → returns enriched routes
3. Frontend renders colored segments on Leaflet map
4. User starts trip → simulated driver walks polyline
5. Proximity check at each step → voice alert within 600m
6. Emergency: voice/button → confirmation → simulated alert with nearest services
