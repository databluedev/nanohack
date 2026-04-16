import { NextRequest, NextResponse } from 'next/server';
import { findSafeDestinationsOverpass } from '@/lib/backend/destinations';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    lat,
    lng,
    category = null,
    radius_m = 5000.0,
    min_safety = 50,
  } = body;

  const results = await findSafeDestinationsOverpass(lat, lng, category, radius_m, min_safety);
  return NextResponse.json({ destinations: results, count: results.length });
}
