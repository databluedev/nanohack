import { NextRequest, NextResponse } from 'next/server';
import { assessRoute, segmentRisks } from '@/lib/backend/risk-engine';

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
  const { polyline, departure, weather = 'clear' } = body;

  const dep = parseDt(departure);
  const a = assessRoute(polyline, dep, weather);
  const segs = segmentRisks(polyline, a.waypoints);

  return NextResponse.json({ assessment: a, segments: segs });
}
