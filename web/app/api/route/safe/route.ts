import { NextRequest, NextResponse } from 'next/server';
import { fetchRoutes } from '@/lib/backend/routing';
import { assessRoute, segmentRisks } from '@/lib/backend/risk-engine';
import { findNearbyServices } from '@/lib/backend/emergency';

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
    const polyline = r.polyline as [number, number][];
    const a = assessRoute(polyline, dep, weather);
    const segs = segmentRisks(polyline, a.waypoints);

    let policeNearby = 0;
    for (let i = 0; i < polyline.length; i += 10) {
      const services = findNearbyServices(polyline[i][0], polyline[i][1], 1000, 'police');
      policeNearby += services.length;
    }

    let nightPenalty = 0;
    if (dep.getHours() >= 20 || dep.getHours() < 6) {
      for (const w of a.waypoints) {
        if ((w.tags ?? []).includes('low lighting') || (w.tags ?? []).includes('night risk')) {
          nightPenalty += 10;
        }
      }
    }

    const safetyScore = a.total_risk + nightPenalty - policeNearby * 2;
    return {
      ...r, assessment: a, segments: segs,
      safety_score: Math.round(Math.max(0, safetyScore) * 10) / 10,
      police_nearby: policeNearby, night_penalty: nightPenalty,
    };
  });

  enriched.sort((a, b) => a.safety_score - b.safety_score);
  if (enriched.length) enriched[0].recommended = true;

  return NextResponse.json({ routes: enriched, count: enriched.length, mode: 'women_safety' });
}
