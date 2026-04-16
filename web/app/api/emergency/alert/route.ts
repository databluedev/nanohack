import { NextRequest, NextResponse } from 'next/server';
import { simulateAlert } from '@/lib/backend/emergency';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { lat, lng, user_name = 'Driver', alert_type = 'accident' } = body;
  const alert = simulateAlert(lat, lng, user_name, alert_type);
  return NextResponse.json({ ...alert, timestamp: new Date().toISOString() });
}
