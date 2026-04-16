import { NextRequest, NextResponse } from 'next/server';
import { fetchLiveWeather } from '@/lib/backend/weather';

export async function GET(_request: NextRequest) {
  // Quick weather for Chennai center (mirrors /api/weather/chennai)
  const data = await fetchLiveWeather(13.05, 80.22);
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { lat = 13.05, lng = 80.22 } = body;
  const data = await fetchLiveWeather(lat, lng);
  return NextResponse.json(data);
}
