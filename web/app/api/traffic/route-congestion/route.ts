import { NextRequest, NextResponse } from 'next/server';
import { fetchRoutes } from '@/lib/backend/routing';
import { getRouteCongestion } from '@/lib/backend/traffic';

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
    from_lat,
    from_lng,
    to_lat,
    to_lng,
    departure,
    weather = 'clear',
    alternatives = 2,
  } = body;

  const routes = await fetchRoutes(from_lat, from_lng, to_lat, to_lng, 1);
  if (!routes || routes.length === 0) {
    return NextResponse.json({ error: 'No route found' }, { status: 503 });
  }

  const dep = parseDt(departure);
  const isWknd = dep.getDay() === 0 || dep.getDay() === 6;
  const cong = getRouteCongestion(
    routes[0].polyline as [number, number][],
    dep.getHours(),
    isWknd
  );

  return NextResponse.json({ ...cong, route_id: routes[0].id });
}
