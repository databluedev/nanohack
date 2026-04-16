"use client";

import { useEffect, useState } from "react";

type Props = {
  active: boolean;
  riskScore: number;
  hazardCount: number;
  weather: string;
  timeWindow: string;
};

function getHazardPrediction(weather: string, timeWindow: string): string | null {
  if ((weather === "fog" || weather === "heavy_rain") && (timeWindow === "morning" || timeWindow === "latenight")) {
    return "High fog / low visibility probability — reduce speed significantly";
  }
  if ((weather === "rain" || weather === "heavy_rain") && (timeWindow === "night" || timeWindow === "latenight")) {
    return "Slippery road conditions likely — maintain extra following distance";
  }
  if (weather === "fog") return "Fog detected — use low beam headlights, reduce speed";
  if (weather === "heavy_rain") return "Heavy rain — risk of waterlogging and hydroplaning";
  if (weather === "rain" && timeWindow === "evening") return "Rain during peak hours — reduced visibility and congestion";
  return null;
}

export function DangerBanner({ active, riskScore, hazardCount, weather, timeWindow }: Props) {
  const [visible, setVisible] = useState(false);
  const [prediction, setPrediction] = useState<string | null>(null);

  useEffect(() => {
    setVisible(active);
    setPrediction(getHazardPrediction(weather, timeWindow));
  }, [active, weather, timeWindow]);

  if (!visible && !prediction) return null;

  return (
    <div className="space-y-2 stage-enter">
      {visible && (
        <div className="danger-glow glass-panel rounded-2xl px-4 py-3 border-red-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-red-400">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-red-400 font-bold">
                Danger Mode Active
              </div>
              <div className="text-xs text-red-200/80 mt-0.5">
                Risk {Math.round(riskScore)} &middot; {hazardCount} hazard{hazardCount !== 1 ? "s" : ""} nearby
              </div>
            </div>
          </div>
        </div>
      )}

      {prediction && (
        <div className="glass-panel rounded-2xl px-4 py-3 border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber-400">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-amber-400/80 font-semibold">
                Predictive Alert
              </div>
              <div className="text-xs text-amber-200/70 mt-0.5 leading-relaxed">{prediction}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
