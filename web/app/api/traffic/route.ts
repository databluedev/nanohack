import { NextRequest, NextResponse } from 'next/server';
import { getTrafficOverlay } from '@/lib/backend/traffic';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    lat = 13.05,
    lng = 80.22,
    hour = 18,
    is_weekend = false,
    radius_km = 8.0,
  } = body;

  const cells = getTrafficOverlay(lat, lng, hour, is_weekend, radius_km);
  return NextResponse.json({ cells, count: cells.length, hour });
}
