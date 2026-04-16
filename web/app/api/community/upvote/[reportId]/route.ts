import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { var __communityReports: any[] | undefined; }

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params;
  const id = parseInt(reportId, 10);
  const reports = globalThis.__communityReports ?? [];
  const report = reports.find((r) => r.id === id);
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  report.upvotes = (report.upvotes ?? 0) + 1;
  return NextResponse.json(report);
}
