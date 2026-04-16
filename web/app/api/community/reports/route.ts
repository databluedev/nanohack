import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { var __communityReports: any[] | undefined; }
if (!globalThis.__communityReports) globalThis.__communityReports = [];

const REPORT_EXPIRY_HOURS: Record<string, number> = {
  pothole: 168, waterlogging: 24, construction: 720,
  blind_turn: 2160, accident_spot: 72, other: 48,
};

export async function GET() {
  const reports = globalThis.__communityReports ?? [];
  const now = new Date();
  const active = reports.filter((r) => {
    const created = new Date(r.timestamp);
    if (isNaN(created.getTime())) return false;
    const ageHours = (now.getTime() - created.getTime()) / 3600000;
    const ttl = REPORT_EXPIRY_HOURS[r.type] ?? 48;
    const effectiveTtl = ttl * (1 + (r.upvotes ?? 0) * 0.25);
    if (ageHours > effectiveTtl) return false;
    r.hours_remaining = Math.round((effectiveTtl - ageHours) * 10) / 10;
    r.freshness = ageHours < ttl * 0.3 ? 'fresh' : ageHours < ttl * 0.7 ? 'aging' : 'expiring';
    return true;
  });
  if (active.length < reports.length) globalThis.__communityReports = active;
  return NextResponse.json({ reports: active, total: active.length, expired_cleaned: reports.length - active.length });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { lat, lng, report_type, description = '', severity = 2 } = body;
  const reports = globalThis.__communityReports ?? [];
  const report = { id: reports.length + 1, lat, lng, type: report_type, description, severity, timestamp: new Date().toISOString(), upvotes: 0 };
  reports.push(report);
  globalThis.__communityReports = reports;
  return NextResponse.json(report);
}
