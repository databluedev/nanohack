"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RiskBadge } from "@/components/RiskBadge";
import type { LatLng, Route, Waypoint } from "@/lib/types";

type Props = {
  route: Route;
  onPositionChange: (pos: LatLng) => void;
  onAnnounce: (text: string) => void;
  onStop: () => void;
  onComplete: (summary: { hazardsHit: number; risk: number }) => void;
};

function distMeters(a: number, b: number, c: number, d: number) {
  const R = 6371000;
  const toR = (x: number) => (x * Math.PI) / 180;
  const dLat = toR(c - a);
  const dLng = toR(d - b);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(a)) * Math.cos(toR(c)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function polyKm(poly: LatLng[]) {
  let t = 0;
  for (let i = 1; i < poly.length; i++) {
    t += distMeters(poly[i - 1][0], poly[i - 1][1], poly[i][0], poly[i][1]);
  }
  return t / 1000;
}

export function DrivePanel({
  route,
  onPositionChange,
  onAnnounce,
  onStop,
  onComplete,
}: Props) {
  const [idx, setIdx] = useState(0);
  const announcedRef = useRef<Set<string>>(new Set());
  const hazardsHitRef = useRef(0);

  const poly = route.polyline;

  // step through route
  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => {
        const next = i + 1;
        if (next >= poly.length) {
          clearInterval(t);
          setTimeout(
            () =>
              onComplete({
                hazardsHit: hazardsHitRef.current,
                risk: route.assessment.total_risk,
              }),
            300
          );
          return i;
        }
        return next;
      });
    }, 220);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // notify map + check hazards
  useEffect(() => {
    const pos = poly[idx];
    if (!pos) return;
    onPositionChange(pos);
    for (const w of route.assessment.waypoints) {
      if (announcedRef.current.has(w.name)) continue;
      const d = distMeters(pos[0], pos[1], w.lat, w.lng);
      if (d < 600) {
        announcedRef.current.add(w.name);
        hazardsHitRef.current += 1;
        onAnnounce(w.voice);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const pct = Math.min(100, Math.round((idx / Math.max(1, poly.length - 1)) * 100));
  const remainingKm = useMemo(() => polyKm(poly.slice(idx)), [idx, poly]);

  // "current risk" = base + decayed proximity
  const currentRisk = useMemo(() => {
    const pos = poly[idx];
    if (!pos) return 0;
    let nearMax = 0;
    for (const w of route.assessment.waypoints) {
      const d = distMeters(pos[0], pos[1], w.lat, w.lng);
      if (d < 1500) nearMax = Math.max(nearMax, w.score * (1 - d / 1500));
    }
    return Math.min(100, route.assessment.total_risk * 0.5 + nearMax * 8);
  }, [idx, poly, route]);

  const upcoming: (Waypoint & { d: number })[] = useMemo(() => {
    const pos = poly[idx];
    if (!pos) return [];
    return route.assessment.waypoints
      .filter((w) => !announcedRef.current.has(w.name))
      .map((w) => ({ ...w, d: distMeters(pos[0], pos[1], w.lat, w.lng) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
  }, [idx, poly, route]);

  return (
    <Card className="bg-slate-950/80 backdrop-blur border-slate-800">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">In Trip</CardTitle>
        <Button size="sm" variant="ghost" onClick={onStop}>
          Stop
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-slate-900/60 rounded-lg p-3">
          <div className="text-xs text-slate-400">Current Risk</div>
          <div className="flex items-baseline gap-3 mt-1">
            <div className="text-3xl font-bold">{Math.round(currentRisk)}</div>
            <RiskBadge score={currentRisk} />
          </div>
        </div>

        <div className="bg-slate-900/60 rounded-lg p-3">
          <div className="text-xs text-slate-400">Progress</div>
          <Progress value={pct} className="mt-2" />
          <div className="flex justify-between text-xs mt-1 text-slate-400">
            <span>{pct}%</span>
            <span>{remainingKm.toFixed(1)} km left</span>
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">
            Upcoming Hazards
          </div>
          {upcoming.length === 0 ? (
            <div className="text-xs text-slate-500">No more hazards ahead</div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((w) => (
                <div
                  key={w.name}
                  className="bg-slate-900/60 rounded p-2 text-xs"
                >
                  <div className="font-semibold text-amber-300">{w.name}</div>
                  <div className="text-slate-400">
                    {(w.d / 1000).toFixed(1)} km away · score {w.score}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
