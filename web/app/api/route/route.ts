import { NextRequest, NextResponse } from 'next/server';
import { fetchRoutes } from '@/lib/backend/routing';
import { assessRoute, segmentRisks } from '@/lib/backend/risk-engine';

function parseDt(s?: string | null): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { from_lat, from_lng, to_lat, to_lng, departure, weather = 'clear', alternatives = 2 } = body;

  const routes = await fetchRoutes(from_lat, from_lng, to_lat, to_lng, alternatives);
  if (!routes || routes.length === 0) {
    return NextResponse.json({ error: 'No route found' }, { status: 503 });
  }

  const dep = parseDt(departure);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched: any[] = routes.map((r) => {
    const poly = r.polyline as [number, number][];
    const a = assessRoute(poly, dep, weather);
    const segs = segmentRisks(poly, a.waypoints);
    return { ...r, assessment: a, segments: segs };
  });

  enriched.sort((a, b) => a.assessment.total_risk - b.assessment.total_risk);
  if (enriched.length) enriched[0].recommended = true;

  return NextResponse.json({ routes: enriched, count: enriched.length });
}
