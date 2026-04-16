"use client";

import { useState } from "react";
import type { RiskExplanation } from "@/lib/types";

type Props = {
  explanations: RiskExplanation[];
  onClose: () => void;
};

export function RiskExplainer({ explanations, onClose }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  return (
    <div className="glass-panel rounded-2xl stage-enter">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber-400"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          </div>
          <span className="font-semibold text-sm">Risk Analysis</span>
        </div>
        <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-300 transition px-2 py-1 rounded-lg hover:bg-slate-800/50">Close</button>
      </div>

      <div className="px-5 pb-5 space-y-2 max-h-[60vh] overflow-y-auto panel-scroll">
        {explanations.map((exp, i) => {
          const isExpanded = expandedIdx === i;
          const scoreColor = exp.score >= 5 ? "text-red-400" : exp.score >= 1.5 ? "text-amber-400" : "text-emerald-400";
          return (
            <button
              key={exp.name}
              onClick={() => setExpandedIdx(isExpanded ? null : i)}
              className={`w-full text-left surface-raised px-4 py-3 transition-all ${isExpanded ? "border-amber-500/20" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-xs">{exp.name}</div>
                <span className={`text-xs font-bold ${scoreColor}`}>{exp.score}</span>
              </div>
              <div className="flex gap-1 mt-1">
                <span className="text-[9px] bg-slate-800/60 text-slate-500 px-1.5 py-0.5 rounded">{exp.junction_type}</span>
                {exp.tags.slice(0, 2).map((t) => (
                  <span key={t} className="text-[9px] bg-slate-800/60 text-slate-500 px-1.5 py-0.5 rounded">{t}</span>
                ))}
              </div>

              {isExpanded && (
                <div className="mt-3 space-y-3 stage-enter" onClick={(e) => e.stopPropagation()}>
                  {/* Contributing Factors */}
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.15em] text-red-400/60 font-semibold mb-1.5">Why This Is Risky</div>
                    <div className="space-y-1">
                      {exp.contributing_factors.map((f, j) => (
                        <div key={j} className="flex items-start gap-2 text-[11px] text-slate-400">
                          <span className="text-red-400/50 mt-0.5">&bull;</span>
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Safety Advice */}
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.15em] text-emerald-400/60 font-semibold mb-1.5">What You Should Do</div>
                    <div className="space-y-1">
                      {exp.safety_advice.map((a, j) => (
                        <div key={j} className="flex items-start gap-2 text-[11px] text-emerald-300/70">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-emerald-500 mt-0.5 flex-shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                          <span>{a}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Base risk */}
                  <div className="text-[10px] text-slate-600 border-t border-slate-800 pt-2">
                    Base risk: {exp.base_risk}/100 &middot; Current multiplied score: {exp.score}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
