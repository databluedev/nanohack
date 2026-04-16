import { NextRequest, NextResponse } from 'next/server';
import { fetchRoutes } from '@/lib/backend/routing';
import { assessRoute, riskWindow } from '@/lib/backend/risk-engine';
import { fetchLiveWeather } from '@/lib/backend/weather';

function parseDt(s?: string | null): Date {
  if (!s) return new Date();
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date() : d;
  } catch {
    return new Date();
  }
}

function buildNotifyMessage(
  shouldNotify: boolean,
  pctIncrease: number,
  best: Record<string, unknown> | null,
  bestSaving: number
): string {
  if (!shouldNotify) return 'Conditions are normal.';
  let msg = `Today's conditions increase risk by ${Math.round(pctIncrease)}%.`;
  if (best && bestSaving > 10) {
    const label = (best.label as string) ?? 'later';
    msg += ` Leave at ${label} to cut risk by ${bestSaving}%.`;
  }
  return msg;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    from_lat,
    from_lng,
    to_lat,
    to_lng,
    departure,
    weather = 'clear',
    alternatives = 2,
  } = body;

  const dep = parseDt(departure);

  const routes = await fetchRoutes(from_lat, from_lng, to_lat, to_lng, 1);
  if (!routes || routes.length === 0) {
    return NextResponse.json({ should_notify: false });
  }

  const currentAssessment = assessRoute(routes[0].polyline as [number, number][], dep, weather);

  // Compare with clear-weather, midday baseline
  const baselineTime = new Date(dep);
  baselineTime.setHours(12, 0, 0, 0);
  const baselineAssessment = assessRoute(
    routes[0].polyline as [number, number][],
    baselineTime,
    'clear'
  );

  const riskIncrease =
    currentAssessment.total_risk - baselineAssessment.total_risk;
  const pctIncrease =
    (riskIncrease / Math.max(1, baselineAssessment.total_risk)) * 100;

  const weatherData = await fetchLiveWeather(from_lat, from_lng);

  // Find best time in next 4 hours
  const slots = riskWindow(
    routes[0].polyline as [number, number][],
    dep,
    weather,
    4,
    30
  );
  const best = slots.length
    ? slots.reduce((min, s) => (s.risk < min.risk ? s : min), slots[0])
    : null;
  const bestSaving = best
    ? Math.round(
        ((currentAssessment.total_risk - best.risk) /
          Math.max(1, currentAssessment.total_risk)) *
          100
      )
    : 0;

  const shouldNotify = pctIncrease > 20 || riskIncrease > 10;

  return NextResponse.json({
    should_notify: shouldNotify,
    current_risk: currentAssessment.total_risk,
    baseline_risk: baselineAssessment.total_risk,
    risk_increase: Math.round(riskIncrease * 10) / 10,
    pct_increase: Math.round(pctIncrease * 10) / 10,
    weather: weatherData,
    best_slot: best,
    best_saving_pct: bestSaving,
    message: buildNotifyMessage(shouldNotify, pctIncrease, best as Record<string, unknown> | null, bestSaving),
  });
}
