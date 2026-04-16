import { NextRequest, NextResponse } from 'next/server';
import { CHENNAI_BLACKSPOTS } from '@/lib/backend/blackspots';
import { haversineM } from '@/lib/backend/risk-engine';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { lat = 13.05, lng = 80.22, radius_km = 8.0 } = body;

  const gridSize = 5; // 5x5 grid
  const stepLat = radius_km / 111.0 / (gridSize / 2);
  const stepLng = stepLat / 0.9; // rough correction for longitude at 13 deg N

  const cells: Array<{
    lat: number;
    lng: number;
    score: number;
    level: string;
    spots_nearby: number;
  }> = [];

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const cellLat = lat + (row - Math.floor(gridSize / 2)) * stepLat;
      const cellLng = lng + (col - Math.floor(gridSize / 2)) * stepLng;

      let spotScore = 0;
      let spotCount = 0;
      for (const spot of CHENNAI_BLACKSPOTS) {
        const d = haversineM(cellLat, cellLng, spot.lat, spot.lng);
        if (d < (radius_km * 1000) / gridSize * 1.5) {
          spotScore += spot.base * Math.max(0.1, 1.0 - d / 3000.0);
          spotCount += 1;
        }
      }

      const norm = Math.min(100, spotScore * 2);
      const level = norm >= 60 ? 'high' : norm >= 25 ? 'medium' : 'low';

      cells.push({
        lat: Math.round(cellLat * 100000) / 100000,
        lng: Math.round(cellLng * 100000) / 100000,
        score: Math.round(norm * 10) / 10,
        level,
        spots_nearby: spotCount,
      });
    }
  }

  return NextResponse.json({
    cells,
    grid_size: gridSize,
    center: { lat, lng },
  });
}
