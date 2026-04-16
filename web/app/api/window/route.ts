import { NextRequest, NextResponse } from 'next/server';
import { riskWindow } from '@/lib/backend/risk-engine';

function parseDt(s?: string | null): Date {
  if (!s) return new Date();
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date() : d;
  } catch {
    return new Date();
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    polyline,
    weather = 'clear',
    horizon_hours = 6,
    step_min = 30,
    base,
  } = body;

  const baseDt = parseDt(base);
  const slots = riskWindow(polyline, baseDt, weather, horizon_hours, step_min);

  // Find best slot
  const best = slots.length
    ? slots.reduce((min, s) => (s.risk < min.risk ? s : min), slots[0])
    : null;
  const nowRisk = slots.length ? slots[0].risk : 0;
  const saving =
    best && nowRisk > 0
      ? Math.round(((nowRisk - best.risk) / nowRisk) * 1000) / 10
      : 0;

  return NextResponse.json({
    slots,
    best_slot: best,
    saving_pct: saving,
  });
}
