import { NextRequest, NextResponse } from 'next/server';
import { CHENNAI_BLACKSPOTS } from '@/lib/backend/blackspots';

export async function GET(_request: NextRequest) {
  return NextResponse.json({ spots: CHENNAI_BLACKSPOTS });
}
