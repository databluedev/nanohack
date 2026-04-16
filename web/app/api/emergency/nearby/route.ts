import { NextRequest, NextResponse } from 'next/server';
import { findNearbyServicesOverpass } from '@/lib/backend/emergency';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    lat,
    lng,
    radius_m = 5000.0,
    service_type = null,
  } = body;

  const services = await findNearbyServicesOverpass(lat, lng, radius_m, service_type);
  return NextResponse.json({
    services,
    count: services.length,
    location: { lat, lng },
  });
}
