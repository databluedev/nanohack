import { NextResponse } from 'next/server';
import { fetchLiveWeather } from '@/lib/backend/weather';

export async function GET() {
  const data = await fetchLiveWeather(13.05, 80.22);
  return NextResponse.json(data);
}
