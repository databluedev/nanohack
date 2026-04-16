import { NextRequest, NextResponse } from 'next/server';
import { assessRoute } from '@/lib/backend/risk-engine';
import { CHENNAI_BLACKSPOTS } from '@/lib/backend/blackspots';

function parseDt(s?: string | null): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { polyline, departure, weather = 'clear' } = body;

  const dep = parseDt(departure);
  const a = assessRoute(polyline, dep, weather);

  const explanations = a.waypoints.map((w) => {
    const spotData = CHENNAI_BLACKSPOTS.find((s) => s.name === w.name);

    const timeWin = a.context.time_window;
    const dayType = a.context.day_type;
    const weatherCtx = a.context.weather;

    const factors: string[] = [];
    if (timeWin === 'evening' || timeWin === 'night')
      factors.push(`Evening/night hours increase accident probability by ~${Math.round((1.5 - 1) * 100)}%`);
    if (timeWin === 'morning')
      factors.push('Morning rush: higher two-wheeler density and fatigue-related incidents');
    if (weatherCtx === 'rain' || weatherCtx === 'heavy_rain')
      factors.push(`Rain reduces visibility and traction — risk multiplied by ~${weatherCtx === 'rain' ? 1.6 : 1.9}x`);
    if (weatherCtx === 'fog')
      factors.push('Fog drastically reduces visibility — risk multiplied by ~1.7x');
    if (dayType === 'weekend')
      factors.push('Weekend traffic patterns differ — more recreational vehicles');

    const tags = spotData?.tags ?? w.tags ?? [];
    const junction = spotData?.junction_type ?? w.junction_type ?? 'unknown';

    for (const tag of tags) {
      if (tag === 'waterlogging') factors.push('Known waterlogging area — standing water in rain');
      else if (tag === 'overspeeding') factors.push('Common overspeeding zone — insufficient enforcement');
      else if (tag === 'low lighting') factors.push('Poor street lighting — reduced visibility after dark');
      else if (tag === 'school zone') factors.push('School zone — unpredictable pedestrian movement');
      else if (tag === 'two-wheeler zone') factors.push('High two-wheeler density — frequent weaving and lane changes');
      else if (tag === 'truck traffic') factors.push('Heavy goods vehicles — large blind spots, wide turns');
    }

    const advice: string[] = [];
    if (w.score > 5) advice.push('Reduce speed to 30 km/h or below');
    if (junction === 'roundabout' || junction === 'cloverleaf') advice.push('Yield to traffic already in the roundabout');
    if (junction === 'signal') advice.push('Do not jump the signal even if road appears clear');
    if (weatherCtx.includes('rain')) advice.push('Maintain 3-second following distance');
    if (timeWin === 'night' || timeWin === 'latenight') advice.push('Use high beam on stretches without oncoming traffic');
    advice.push('Stay alert and avoid distractions');

    return {
      name: w.name, score: w.score, junction_type: junction, tags,
      base_risk: spotData?.base ?? 0,
      contributing_factors: factors, safety_advice: advice,
      voice: w.voice, lat: w.lat, lng: w.lng,
    };
  });

  return NextResponse.json({ explanations, context: a.context, total_risk: a.total_risk });
}
