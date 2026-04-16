import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { var __tripSessions: Map<string, any> | undefined; }

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  const { shareId } = await params;
  const session = globalThis.__tripSessions?.get(shareId);
  if (!session) return NextResponse.json({ error: 'Trip not found or expired' }, { status: 404 });
  return NextResponse.json(session);
}
