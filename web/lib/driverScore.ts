import type { DriverScore } from "./types";

const STORAGE_KEY = "saferoute_driver_score";

function defaultScore(): DriverScore {
  return {
    total_trips: 0, safe_trips: 0, hazards_avoided: 0,
    avg_risk: 0, streak_days: 0, score: 100, percentile: 50,
    last_updated: new Date().toISOString(),
  };
}

export function loadDriverScore(): DriverScore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultScore();
    return JSON.parse(raw) as DriverScore;
  } catch { return defaultScore(); }
}

export function updateDriverScore(tripRisk: number, hazardsEncountered: number, totalHazards: number) {
  const ds = loadDriverScore();
  ds.total_trips += 1;

  const hazardsAvoided = Math.max(0, totalHazards - hazardsEncountered);
  ds.hazards_avoided += hazardsAvoided;

  if (tripRisk < 50) ds.safe_trips += 1;

  // Rolling average risk
  ds.avg_risk = Math.round(((ds.avg_risk * (ds.total_trips - 1)) + tripRisk) / ds.total_trips);

  // Streak: if last update was yesterday or today, maintain/increment
  const lastDate = new Date(ds.last_updated).toDateString();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (lastDate === today) {
    // same day, keep streak
  } else if (lastDate === yesterday) {
    ds.streak_days += 1;
  } else {
    ds.streak_days = 1; // reset
  }

  // Compute score: 100 base, +2 per safe trip, -5 per high-risk trip, +1 per hazard avoided
  const safeBonus = ds.safe_trips * 2;
  const riskPenalty = (ds.total_trips - ds.safe_trips) * 5;
  const avoidBonus = ds.hazards_avoided;
  ds.score = Math.min(100, Math.max(0, Math.round(70 + safeBonus - riskPenalty + avoidBonus * 0.5)));

  // Simulated percentile (based on score)
  ds.percentile = Math.min(99, Math.max(1, Math.round(ds.score * 0.95)));

  ds.last_updated = new Date().toISOString();

  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ds)); } catch { /* ok */ }
  return ds;
}
