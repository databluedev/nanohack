import { NextRequest, NextResponse } from 'next/server';
import { CHENNAI_SAFE_ZONES } from '@/lib/backend/blackspots';

export async function GET(_request: NextRequest) {
  return NextResponse.json({ zones: CHENNAI_SAFE_ZONES, count: CHENNAI_SAFE_ZONES.length });
}
