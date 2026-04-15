"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlanPanel } from "@/components/PlanPanel";
import { DrivePanel } from "@/components/DrivePanel";
import { ReceiptPanel } from "@/components/ReceiptPanel";
import { VoiceBanner } from "@/components/VoiceBanner";
import type { LatLng, Route } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type Stage = "plan" | "drive" | "receipt";

export default function Home() {
  const [stage, setStage] = useState<Stage>("plan");
  const [routes, setRoutes] = useState<Route[]>([]);
  const [chosenIdx, setChosenIdx] = useState(0);
  const [driverPos, setDriverPos] = useState<LatLng | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ hazardsHit: number; risk: number }>({
    hazardsHit: 0,
    risk: 0,
  });
  const voiceTimer = useRef<number | null>(null);

  const handleRoutes = useCallback((rs: Route[]) => {
    setRoutes(rs);
    setChosenIdx(0);
  }, []);

  const handleChoose = useCallback((idx: number) => {
    setRoutes((rs) => {
      const next = [...rs];
      const [picked] = next.splice(idx, 1);
      next.unshift(picked);
      return next;
    });
    setChosenIdx(0);
  }, []);

  const handleStart = useCallback(() => {
    if (routes.length === 0) return;
    setStage("drive");
    setDriverPos(routes[0].polyline[0]);
  }, [routes]);

  const handleStop = useCallback(() => {
    setStage("plan");
    setDriverPos(null);
  }, []);

  const handleComplete = useCallback(
    (s: { hazardsHit: number; risk: number }) => {
      setSummary(s);
      setStage("receipt");
      setDriverPos(null);
    },
    []
  );

  const handleAnnounce = useCallback((text: string) => {
    setVoice(text);
    if (voiceTimer.current) window.clearTimeout(voiceTimer.current);
    voiceTimer.current = window.setTimeout(() => setVoice(null), 5000);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1;
        u.pitch = 1;
        u.volume = 1;
        window.speechSynthesis.speak(u);
      } catch {
        /* ignore */
      }
    }
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([80, 40, 80]);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(
    () => () => {
      if (voiceTimer.current) window.clearTimeout(voiceTimer.current);
    },
    []
  );

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <div className="absolute inset-0">
        <MapView
          routes={routes}
          driverPos={driverPos}
          followDriver={stage === "drive"}
        />
      </div>

      <header className="absolute top-3 left-3 z-[1000] rounded-xl border border-slate-800 bg-slate-950/80 backdrop-blur px-3 py-2 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="text-lg">🛡️</span>
          <div className="leading-tight">
            <div className="font-semibold text-sm">SafeWindow</div>
            <div className="text-[10px] text-slate-400">
              Chennai Risk Co-Pilot
            </div>
          </div>
        </div>
      </header>

      <aside className="absolute top-3 right-3 z-[1000] w-[380px] max-w-[92vw] max-h-[calc(100vh-24px)] overflow-y-auto">
        {stage === "plan" && (
          <PlanPanel
            routes={routes}
            chosenIdx={chosenIdx}
            onRoutes={handleRoutes}
            onChooseRoute={handleChoose}
            onStart={handleStart}
          />
        )}
        {stage === "drive" && routes.length > 0 && (
          <DrivePanel
            route={routes[0]}
            onPositionChange={setDriverPos}
            onAnnounce={handleAnnounce}
            onStop={handleStop}
            onComplete={handleComplete}
          />
        )}
        {stage === "receipt" && (
          <ReceiptPanel
            hazardsHit={summary.hazardsHit}
            risk={summary.risk}
            onNewTrip={() => setStage("plan")}
          />
        )}
      </aside>

      <VoiceBanner text={voice} />
    </div>
  );
}
