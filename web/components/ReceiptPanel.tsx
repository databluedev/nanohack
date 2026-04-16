"use client";

import { useEffect, useState } from "react";
import { RiskGauge } from "@/components/RiskBadge";
import { saveTripMemory } from "@/lib/tripMemory";
import type { Weather } from "@/lib/types";

type Props = {
  hazardsHit: number;
  risk: number;
  onNewTrip: () => void;
  tripMeta?: {
    from: string;
    to: string;
    weather: Weather;
    hour: number;
    routeId: string;
  };
};

export function ReceiptPanel({ hazardsHit, risk, onNewTrip, tripMeta }: Props) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (tripMeta && !saved) {
      saveTripMemory({
        from: tripMeta.from, to: tripMeta.to, weather: tripMeta.weather,
        hour: tripMeta.hour, risk, hazards: hazardsHit,
        timestamp: new Date().toISOString(), routeId: tripMeta.routeId,
      });
      setSaved(true);
    }
  }, [tripMeta, risk, hazardsHit, saved]);

  const safetyScore = Math.round(100 - risk);
  const grade =
    safetyScore >= 75 ? { label: "Excellent", color: "text-emerald-400" } :
    safetyScore >= 50 ? { label: "Good", color: "text-blue-400" } :
    safetyScore >= 30 ? { label: "Moderate", color: "text-amber-400" } :
    { label: "Risky", color: "text-red-400" };

  return (
    <div className="glass-panel rounded-2xl stage-enter">
      <div className="px-5 pt-5 pb-2">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-emerald-400">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <span className="font-semibold text-sm">Trip Complete</span>
        </div>
      </div>

      <div className="px-5 pb-5 space-y-4">
        {/* Safety score with gauge */}
        <div className="flex items-center justify-center py-3">
          <div className="text-center">
            <RiskGauge score={100 - risk} size={120} />
            <div className={`text-sm font-semibold mt-2 ${grade.color}`}>{grade.label}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-[0.15em] mt-0.5">Safety Score</div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="surface-raised px-4 py-3 text-center">
            <div className="text-2xl font-bold text-slate-200">{Math.round(risk)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">Route Risk</div>
          </div>
          <div className="surface-raised px-4 py-3 text-center">
            <div className="text-2xl font-bold text-slate-200">{hazardsHit}</div>
            <div className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">Warnings</div>
          </div>
        </div>

        {/* Trip summary */}
        {tripMeta && (
          <div className="surface-raised px-3 py-2.5 flex items-center gap-2 text-xs text-slate-500">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-600 flex-shrink-0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span className="truncate">{tripMeta.from} &rarr; {tripMeta.to} &middot; {tripMeta.weather} &middot; {tripMeta.hour}:00</span>
          </div>
        )}

        {saved && (
          <div className="text-[10px] text-blue-400/70 text-center flex items-center justify-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
            Saved to Route Memory
          </div>
        )}

        <button
          onClick={onNewTrip}
          className="btn-press w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-900/30 hover:shadow-blue-900/50 transition-all"
        >
          Plan New Trip
        </button>
      </div>
    </div>
  );
}
