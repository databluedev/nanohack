import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { var __tripSessions: Map<string, any> | undefined; }

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { trip_id, lat, lng, risk = 0, pct = 0, status = 'driving' } = body;

  const sessions = globalThis.__tripSessions;
  if (!sessions) return NextResponse.json({ ok: false, error: 'Session not found' });

  for (const [, session] of sessions) {
    if (session.trip_id === trip_id) {
      session.position = { lat, lng };
      session.risk = risk;
      session.pct = pct;
      session.status = status;
      session.last_update = new Date().toISOString();
      return NextResponse.json({ ok: true });
    }
  }
  return NextResponse.json({ ok: false, error: 'Session not found' });
}
