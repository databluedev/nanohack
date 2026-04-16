import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { var __communityReports: any[] | undefined; }
if (!globalThis.__communityReports) globalThis.__communityReports = [];

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { lat, lng, report_type, description = '', severity = 2 } = body;
  const reports = globalThis.__communityReports ?? [];
  const report = { id: reports.length + 1, lat, lng, type: report_type, description, severity, timestamp: new Date().toISOString(), upvotes: 0 };
  reports.push(report);
  globalThis.__communityReports = reports;
  return NextResponse.json(report);
}
