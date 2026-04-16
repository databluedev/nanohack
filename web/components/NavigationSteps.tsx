"use client";

import type { NavigationStep, Waypoint } from "@/lib/types";

type Props = {
  steps: NavigationStep[];
  currentStepIdx: number;
  waypoints: Waypoint[];
};

const STEP_ICONS: Record<string, string> = {
  depart: "\u{1F6A9}", arrive: "\u{1F3C1}", turn: "\u21A9", straight: "\u2B06",
  merge: "\u2934", ramp: "\u2197", fork: "\u2B06", roundabout: "\u{1F504}",
  end: "\u26D4", info: "\u2139",
};

function distLabel(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function findNearbyHazard(step: NavigationStep, waypoints: Waypoint[]): Waypoint | null {
  for (const w of waypoints) {
    const d = Math.sqrt(Math.pow(w.lat - step.location[0], 2) + Math.pow(w.lng - step.location[1], 2)) * 111000;
    if (d < 800) return w;
  }
  return null;
}

export function NavigationSteps({ steps, currentStepIdx, waypoints }: Props) {
  if (!steps || steps.length === 0) return null;

  const currentStep = steps[currentStepIdx] ?? steps[0];
  const nextStep = steps[currentStepIdx + 1];

  return (
    <div className="space-y-2">
      {/* Current instruction — big and clear */}
      <div className="surface-raised px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 text-lg">
            {STEP_ICONS[currentStep.icon] ?? "\u2B06"}
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-200 leading-snug">
              {currentStep.instruction}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {distLabel(currentStep.distance_m)}
              {currentStep.duration_s > 0 && ` \u00B7 ${Math.ceil(currentStep.duration_s / 60)} min`}
            </div>
            {/* Safety warning if near a hazard */}
            {(() => {
              const hazard = findNearbyHazard(currentStep, waypoints);
              if (!hazard) return null;
              return (
                <div className="mt-2 px-2 py-1.5 rounded-lg bg-red-950/30 border border-red-500/20 text-[11px] text-red-300 flex items-start gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-400 mt-0.5 flex-shrink-0">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <span>{hazard.voice}</span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Next step preview */}
      {nextStep && (
        <div className="surface-raised px-3 py-2 flex items-center gap-2 opacity-60">
          <span className="text-xs">{STEP_ICONS[nextStep.icon] ?? "\u2B06"}</span>
          <span className="text-[11px] text-slate-400 truncate flex-1">Then: {nextStep.instruction}</span>
          <span className="text-[10px] text-slate-600">{distLabel(nextStep.distance_m)}</span>
        </div>
      )}

      {/* Remaining steps count */}
      <div className="text-[10px] text-slate-600 text-center">
        Step {currentStepIdx + 1} of {steps.length}
      </div>
    </div>
  );
}
