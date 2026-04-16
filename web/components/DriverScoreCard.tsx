"use client";

import type { DriverScore } from "@/lib/types";
import { RiskGauge } from "@/components/RiskBadge";

type Props = {
  score: DriverScore;
  onClose: () => void;
};

export function DriverScoreCard({ score, onClose }: Props) {
  return (
    <div className="glass-panel rounded-2xl stage-enter">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-400">
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
            </svg>
          </div>
          <span className="font-semibold text-sm">Driver Safety Profile</span>
        </div>
        <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-300 transition px-2 py-1">Close</button>
      </div>

      <div className="px-5 pb-5 space-y-4">
        {/* Score gauge */}
        <div className="flex justify-center py-2">
          <RiskGauge score={score.score} size={110} />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Trips", value: score.total_trips, color: "text-blue-400" },
            { label: "Safe Trips", value: score.safe_trips, color: "text-emerald-400" },
            { label: "Streak", value: `${score.streak_days}d`, color: "text-amber-400" },
          ].map((stat) => (
            <div key={stat.label} className="surface-raised px-3 py-2.5 text-center">
              <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="surface-raised px-3 py-2.5 text-center">
            <div className="text-lg font-bold text-slate-200">{score.hazards_avoided}</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5">Hazards Avoided</div>
          </div>
          <div className="surface-raised px-3 py-2.5 text-center">
            <div className="text-lg font-bold text-cyan-400">Top {100 - score.percentile}%</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5">Percentile</div>
          </div>
        </div>

        {/* Streak encouragement */}
        {score.streak_days > 0 && (
          <div className="surface-raised px-4 py-3 text-center border-amber-500/15">
            <div className="text-sm">
              {score.streak_days >= 7 ? "\u{1F525}" : score.streak_days >= 3 ? "\u{2B50}" : "\u{1F4AA}"}{" "}
              <span className="font-semibold text-amber-300">{score.streak_days}-day streak!</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Keep driving safely to build your score</div>
          </div>
        )}
      </div>
    </div>
  );
}
