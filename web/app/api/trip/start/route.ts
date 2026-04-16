import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { var __tripSessions: Map<string, any> | undefined; }
if (!globalThis.__tripSessions) globalThis.__tripSessions = new Map();

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { trip_id, from_name, to_name, polyline, weather = 'clear', risk = 0, driver_name = 'Driver' } = body;

  const shareId = Math.random().toString(36).slice(2, 10);
  const session = {
    trip_id, share_id: shareId, from: from_name, to: to_name,
    driver: driver_name, weather, risk,
    started_at: new Date().toISOString(), last_update: new Date().toISOString(),
    position: polyline?.length ? { lat: polyline[0][0], lng: polyline[0][1] } : null,
    pct: 0, status: 'driving',
    polyline: (polyline ?? []).slice(0, 200),
  };
  globalThis.__tripSessions!.set(shareId, session);
  return NextResponse.json({ share_id: shareId, share_url: `/family/${shareId}` });
}
