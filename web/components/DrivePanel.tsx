"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RiskGauge } from "@/components/RiskBadge";
import { NavigationSteps } from "@/components/NavigationSteps";
import { FamilyShareButton } from "@/components/FamilyShare";
import type { LatLng, Route, Waypoint } from "@/lib/types";

type Props = {
  route: Route;
  fromName: string;
  toName: string;
  onPositionChange: (pos: LatLng) => void;
  onAnnounce: (text: string) => void;
  onStop: () => void;
  onComplete: (summary: { hazardsHit: number; risk: number }) => void;
  onDangerUpdate?: (risk: number, nearbyHazards: number) => void;
  dangerMode?: boolean;
};

function distMeters(a: number, b: number, c: number, d: number) {
  const R = 6371000;
  const toR = (x: number) => (x * Math.PI) / 180;
  const dLat = toR(c - a); const dLng = toR(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a)) * Math.cos(toR(c)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function polyKm(poly: LatLng[]) {
  let t = 0;
  for (let i = 1; i < poly.length; i++) t += distMeters(poly[i-1][0], poly[i-1][1], poly[i][0], poly[i][1]);
  return t / 1000;
}

export function DrivePanel({ route, fromName, toName, onPositionChange, onAnnounce, onStop, onComplete, onDangerUpdate, dangerMode }: Props) {
  const [idx, setIdx] = useState(0);
  const announcedRef = useRef<Set<string>>(new Set());
  const hazardsHitRef = useRef(0);
  const poly = route.polyline;
  const steps = route.steps ?? [];
  const stepInterval = dangerMode ? 150 : 220;

  // Find current navigation step based on position
  const currentStepIdx = useMemo(() => {
    if (steps.length === 0) return 0;
    const pos = poly[idx];
    if (!pos) return 0;
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < steps.length; i++) {
      const loc = steps[i].location;
      if (!loc) continue;
      const d = distMeters(pos[0], pos[1], loc[0], loc[1]);
      if (d < closestDist) { closestDist = d; closestIdx = i; }
    }
    return closestIdx;
  }, [idx, poly, steps]);

  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => {
        const next = i + 1;
        if (next >= poly.length) {
          clearInterval(t);
          setTimeout(() => onComplete({ hazardsHit: hazardsHitRef.current, risk: route.assessment.total_risk }), 300);
          return i;
        }
        return next;
      });
    }, stepInterval);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepInterval]);

  useEffect(() => {
    const pos = poly[idx];
    if (!pos) return;
    onPositionChange(pos);
    let nearbyCount = 0;
    for (const w of route.assessment.waypoints) {
      const d = distMeters(pos[0], pos[1], w.lat, w.lng);
      if (d < 1000) nearbyCount++;
      if (d < 600 && !announcedRef.current.has(w.name)) {
        announcedRef.current.add(w.name);
        hazardsHitRef.current += 1;
        onAnnounce(w.voice);
      }
    }
    if (onDangerUpdate) onDangerUpdate(currentRiskCalc(pos), nearbyCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  function currentRiskCalc(pos: LatLng): number {
    let nearMax = 0;
    for (const w of route.assessment.waypoints) {
      const d = distMeters(pos[0], pos[1], w.lat, w.lng);
      if (d < 1500) nearMax = Math.max(nearMax, w.score * (1 - d / 1500));
    }
    return Math.min(100, route.assessment.total_risk * 0.5 + nearMax * 8);
  }

  const pct = Math.min(100, Math.round((idx / Math.max(1, poly.length - 1)) * 100));
  const remainingKm = useMemo(() => polyKm(poly.slice(idx)), [idx, poly]);
  const currentRisk = useMemo(() => {
    const pos = poly[idx]; return pos ? currentRiskCalc(pos) : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, poly, route]);

  const upcoming: (Waypoint & { d: number })[] = useMemo(() => {
    const pos = poly[idx];
    if (!pos) return [];
    return route.assessment.waypoints
      .filter((w) => !announcedRef.current.has(w.name))
      .map((w) => ({ ...w, d: distMeters(pos[0], pos[1], w.lat, w.lng) }))
      .sort((a, b) => a.d - b.d).slice(0, 3);
  }, [idx, poly, route]);

  return (
    <div className={`glass-panel rounded-2xl stage-enter ${dangerMode ? "danger-glow border-red-500/30" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-sm tracking-wide">Navigating</span>
          {dangerMode && (
            <span className="text-[9px] uppercase tracking-[0.15em] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-bold animate-pulse">Alert</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <FamilyShareButton route={route} fromName={fromName} toName={toName} tripId={route.id} />
          <button onClick={onStop} className="btn-press text-xs text-slate-500 hover:text-red-400 transition px-3 py-1.5 rounded-lg hover:bg-red-950/30">End</button>
        </div>
      </div>

      <div className="px-5 pb-5 space-y-3">
        {/* Turn-by-turn navigation */}
        {steps.length > 0 && (
          <NavigationSteps steps={steps} currentStepIdx={currentStepIdx} waypoints={route.assessment.waypoints} />
        )}

        {/* Risk + Progress */}
        <div className="flex items-center gap-4">
          <RiskGauge score={currentRisk} size={80} />
          <div className="flex-1 space-y-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">Progress</span>
                <span className="text-slate-400 font-medium">{pct}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden relative">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300 ease-out" style={{ width: `${pct}%` }} />
                <div className="absolute inset-0 progress-shimmer rounded-full" />
              </div>
            </div>
            <div className="text-[11px] text-slate-500">{remainingKm.toFixed(1)} km &middot; ~{Math.max(1, Math.round(remainingKm / 0.5))} min</div>
          </div>
        </div>

        {/* Upcoming Hazards */}
        {upcoming.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold mb-1.5">Ahead</div>
            <div className="space-y-1">
              {upcoming.map((w) => (
                <div key={w.name} className={`surface-raised px-3 py-2 ${w.d < 800 ? "proximity-near border-red-500/20 !bg-red-950/15" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${w.d < 800 ? "text-red-300" : "text-amber-300"}`}>{w.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{(w.d / 1000).toFixed(1)} km</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
