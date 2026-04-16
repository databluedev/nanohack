"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlanPanel } from "@/components/PlanPanel";
import { DrivePanel } from "@/components/DrivePanel";
import { ReceiptPanel } from "@/components/ReceiptPanel";
import { VoiceBanner } from "@/components/VoiceBanner";
import { EmergencyButton } from "@/components/EmergencyButton";
import { EmergencyPanel } from "@/components/EmergencyPanel";
import { DangerBanner } from "@/components/DangerBanner";
import { CommunityReportPanel } from "@/components/CommunityReport";
import { CrashDetector } from "@/components/CrashDetector";
import { RiskExplainer } from "@/components/RiskExplainer";
import { DriverScoreCard } from "@/components/DriverScoreCard";
import { sendEmergencyAlert, fetchSafeZones, fetchAreaRisk, fetchCommunityReports, fetchRiskExplanation, fetchTrafficOverlay } from "@/lib/api";
import { SafeDestinations } from "@/components/SafeDestinations";
import { CHENNAI_PRESETS } from "@/lib/presets";
import { updateDriverScore, loadDriverScore } from "@/lib/driverScore";
import type { LatLng, Route, EmergencyService, SafeZone, AreaRiskCell, CommunityReport, Weather, RiskExplanation, DriverScore, TrafficCell } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type Stage = "plan" | "drive" | "receipt";

export default function Home() {
  const [stage, setStage] = useState<Stage>("plan");
  const [routes, setRoutes] = useState<Route[]>([]);
  const [chosenIdx, setChosenIdx] = useState(0);
  const [driverPos, setDriverPos] = useState<LatLng | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ hazardsHit: number; risk: number }>({ hazardsHit: 0, risk: 0 });
  const voiceTimer = useRef<number | null>(null);

  // Emergency
  const [showEmergency, setShowEmergency] = useState(false);
  const [emergencyServices, setEmergencyServices] = useState<EmergencyService[]>([]);

  // Danger mode
  const [dangerMode, setDangerMode] = useState(false);
  const [currentRisk, setCurrentRisk] = useState(0);
  const [nearbyHazardCount, setNearbyHazardCount] = useState(0);
  const [currentWeather, setCurrentWeather] = useState("clear");
  const [currentTimeWindow, setCurrentTimeWindow] = useState("midday");

  // Overlays
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [areaRiskCells, setAreaRiskCells] = useState<AreaRiskCell[]>([]);
  const [communityReports, setCommunityReports] = useState<CommunityReport[]>([]);
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [showAreaRisk, setShowAreaRisk] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showJunctions, setShowJunctions] = useState(true);
  const [showReportForm, setShowReportForm] = useState(false);
  const [useGPS, setUseGPS] = useState(false);
  const gpsWatchRef = useRef<number | null>(null);

  // Trip metadata
  const [selectedFrom, setSelectedFrom] = useState(0);
  const [selectedTo, setSelectedTo] = useState(5);
  const [selectedWeather, setSelectedWeather] = useState<Weather>("clear");
  const [selectedHour, setSelectedHour] = useState(18);

  // New feature states
  const [showRiskExplainer, setShowRiskExplainer] = useState(false);
  const [riskExplanations, setRiskExplanations] = useState<RiskExplanation[]>([]);
  const [showDriverScore, setShowDriverScore] = useState(false);
  const [driverScore, setDriverScore] = useState<DriverScore>(loadDriverScore());
  const [womenSafetyMode, setWomenSafetyMode] = useState(false);
  const [trafficCells, setTrafficCells] = useState<TrafficCell[]>([]);
  const [showTraffic, setShowTraffic] = useState(false);
  const [showSafeDestinations, setShowSafeDestinations] = useState(false);

  // Load overlays
  useEffect(() => {
    fetchSafeZones().then((d) => setSafeZones(d.zones)).catch(() => {});
    fetchAreaRisk().then((d) => setAreaRiskCells(d.cells)).catch(() => {});
    fetchCommunityReports().then((d) => setCommunityReports(d.reports)).catch(() => {});
    fetchTrafficOverlay().then((d) => setTrafficCells(d.cells)).catch(() => {});
  }, []);

  const handleRoutes = useCallback((rs: Route[]) => {
    setRoutes(rs);
    setChosenIdx(0);
    if (rs.length > 0) {
      const ctx = rs[0].assessment.context;
      setCurrentWeather(ctx.weather);
      setCurrentTimeWindow(ctx.time_window);
      setSelectedWeather(ctx.weather as Weather);
      try { setSelectedHour(new Date(ctx.departure).getHours()); } catch { /* ok */ }

      // Load risk explanations
      fetchRiskExplanation({
        polyline: rs[0].polyline,
        departure: ctx.departure,
        weather: ctx.weather as Weather,
      }).then((d) => setRiskExplanations(d.explanations)).catch(() => {});
    }
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
    if (useGPS && "geolocation" in navigator) {
      try {
        const id = navigator.geolocation.watchPosition(
          (pos) => setDriverPos([pos.coords.latitude, pos.coords.longitude]),
          () => {}, { enableHighAccuracy: true, maximumAge: 2000, timeout: 5000 }
        );
        gpsWatchRef.current = id;
      } catch { /* fallback */ }
    }
  }, [routes, useGPS]);

  const handleStop = useCallback(() => {
    setStage("plan"); setDriverPos(null); setDangerMode(false);
    setShowEmergency(false); setEmergencyServices([]);
    if (gpsWatchRef.current !== null) { navigator.geolocation.clearWatch(gpsWatchRef.current); gpsWatchRef.current = null; }
  }, []);

  const handleComplete = useCallback((s: { hazardsHit: number; risk: number }) => {
    setSummary(s); setStage("receipt"); setDriverPos(null); setDangerMode(false);
    if (gpsWatchRef.current !== null) { navigator.geolocation.clearWatch(gpsWatchRef.current); gpsWatchRef.current = null; }
    // Update driver score
    const totalHazards = routes[0]?.assessment.waypoints.length ?? 0;
    const updated = updateDriverScore(s.risk, s.hazardsHit, totalHazards);
    setDriverScore(updated);
  }, [routes]);

  const handleAnnounce = useCallback((text: string) => {
    setVoice(text);
    if (voiceTimer.current) window.clearTimeout(voiceTimer.current);
    voiceTimer.current = window.setTimeout(() => setVoice(null), 5000);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1; u.pitch = 1; u.volume = 1; window.speechSynthesis.speak(u); } catch { /* ok */ }
    }
    if (typeof navigator !== "undefined" && "vibrate" in navigator) { try { navigator.vibrate([80, 40, 80]); } catch { /* ok */ } }
  }, []);

  const handleDangerUpdate = useCallback((risk: number, hazards: number) => {
    setCurrentRisk(risk); setNearbyHazardCount(hazards);
    const isDanger = risk > 70 || hazards >= 2;
    if (isDanger && !dangerMode) { setDangerMode(true); handleAnnounce("Danger mode activated. Multiple hazards detected. Stay alert."); }
    else if (!isDanger && dangerMode) { setDangerMode(false); }
  }, [dangerMode, handleAnnounce]);

  const handleEmergencyTrigger = useCallback(async () => {
    setShowEmergency(true);
    if (driverPos) { try { await sendEmergencyAlert({ lat: driverPos[0], lng: driverPos[1] }); } catch { /* ok */ } }
  }, [driverPos]);

  const handleCrashDetected = useCallback(() => {
    handleEmergencyTrigger();
    handleAnnounce("Crash detected. Emergency services have been contacted.");
  }, [handleEmergencyTrigger, handleAnnounce]);

  useEffect(() => () => {
    if (voiceTimer.current) window.clearTimeout(voiceTimer.current);
    if (gpsWatchRef.current !== null) navigator.geolocation.clearWatch(gpsWatchRef.current);
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <div className="absolute inset-0">
        <MapView
          routes={routes} driverPos={driverPos} followDriver={stage === "drive"}
          emergencyServices={showEmergency ? emergencyServices : undefined}
          safeZones={showSafeZones ? safeZones : undefined}
          areaRiskCells={showAreaRisk ? areaRiskCells : undefined}
          communityReports={showReports ? communityReports : undefined}
          trafficCells={showTraffic ? trafficCells : undefined}
          showJunctions={showJunctions}
        />
      </div>

      {/* Crash Detection — always active during drive */}
      <CrashDetector
        active={stage === "drive"}
        onCrashDetected={handleCrashDetected}
        onCountdownCancel={() => handleAnnounce("Crash detection cancelled.")}
      />

      {/* Header */}
      <header className="absolute top-3 left-3 z-[1000]">
        <div className="glass-panel rounded-2xl px-4 py-2.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-900/30">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-sm tracking-wide">SafeRoute AI</div>
            <div className="text-[10px] text-slate-500">Chennai Risk Co-Pilot</div>
          </div>
          {/* Driver score button */}
          <button
            onClick={() => setShowDriverScore(!showDriverScore)}
            className="toggle-pill text-[10px] px-2 py-1 rounded-full bg-slate-800/50 text-slate-400 hover:text-blue-300 transition ml-1 font-semibold"
            title="Your safety profile"
          >
            {driverScore.score}pts
          </button>
        </div>
      </header>

      {/* Toggle bar */}
      <div className="absolute top-3 left-[260px] z-[1000]">
        <div className="glass-panel rounded-full px-1.5 py-1.5 flex items-center gap-1">
          {([
            ["Safe", showSafeZones, setShowSafeZones],
            ["Risk Map", showAreaRisk, setShowAreaRisk],
            ["Traffic", showTraffic, setShowTraffic],
            ["Reports", showReports, setShowReports],
            ["Junctions", showJunctions, setShowJunctions],
          ] as [string, boolean, (v: boolean) => void][]).map(([label, active, setter]) => (
            <button key={label} onClick={() => setter(!active)}
              className={`toggle-pill text-[10px] px-2.5 py-1 rounded-full font-medium transition-all ${active ? "active bg-blue-600/25 text-blue-300" : "text-slate-500 hover:text-slate-300"}`}>
              {label}
            </button>
          ))}
          {stage === "plan" && (
            <>
              <button onClick={() => setUseGPS(!useGPS)}
                className={`toggle-pill text-[10px] px-2.5 py-1 rounded-full font-medium transition-all ${useGPS ? "active bg-emerald-600/25 text-emerald-300" : "text-slate-500 hover:text-slate-300"}`}>
                GPS
              </button>
              <button onClick={() => setWomenSafetyMode(!womenSafetyMode)}
                className={`toggle-pill text-[10px] px-2.5 py-1 rounded-full font-medium transition-all ${womenSafetyMode ? "active bg-pink-600/25 text-pink-300" : "text-slate-500 hover:text-slate-300"}`}>
                Night Safe
              </button>
            </>
          )}
        </div>
      </div>

      {/* Danger banner */}
      {stage === "drive" && (
        <div className="absolute top-16 left-3 z-[1000] w-[300px] max-w-[40vw]">
          <DangerBanner active={dangerMode} riskScore={currentRisk} hazardCount={nearbyHazardCount} weather={currentWeather} timeWindow={currentTimeWindow} />
        </div>
      )}

      {/* SOS + Report */}
      {stage === "drive" && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1100] flex items-end gap-4">
          <EmergencyButton onTrigger={handleEmergencyTrigger} dangerMode={dangerMode} />
          <button onClick={() => setShowReportForm(!showReportForm)}
            className="btn-press bg-slate-800/80 backdrop-blur text-amber-400 rounded-full w-12 h-12 flex items-center justify-center shadow-xl border border-slate-700/50 hover:scale-105 transition-all">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          </button>
        </div>
      )}

      <aside className="absolute top-3 right-3 z-[1000] w-[380px] max-w-[92vw] max-h-[calc(100vh-24px)] overflow-y-auto panel-scroll space-y-3">
        {showEmergency && (
          <EmergencyPanel position={driverPos} visible onClose={() => { setShowEmergency(false); setEmergencyServices([]); }}
            onServicesLoaded={(s) => setEmergencyServices(s)} />
        )}

        {showReportForm && (
          <CommunityReportPanel position={driverPos} onClose={() => setShowReportForm(false)}
            onReportSubmitted={(r) => { setCommunityReports((prev) => [...prev, r]); setShowReports(true); }} />
        )}

        {showDriverScore && <DriverScoreCard score={driverScore} onClose={() => setShowDriverScore(false)} />}

        {showSafeDestinations && (
          <SafeDestinations
            position={driverPos ?? (routes.length > 0 ? routes[0].polyline[0] : null)}
            onClose={() => setShowSafeDestinations(false)}
          />
        )}

        {showRiskExplainer && riskExplanations.length > 0 && (
          <RiskExplainer explanations={riskExplanations} onClose={() => setShowRiskExplainer(false)} />
        )}

        {stage === "plan" && (
          <>
            <PlanPanel routes={routes} chosenIdx={chosenIdx} onRoutes={handleRoutes} onChooseRoute={handleChoose} onStart={handleStart} />
            {/* Risk explainer toggle — appears after routes loaded */}
            {routes.length > 0 && riskExplanations.length > 0 && !showRiskExplainer && (
              <button onClick={() => setShowRiskExplainer(true)}
                className="btn-press w-full py-2.5 rounded-xl text-xs font-semibold glass-panel border-amber-500/15 text-amber-300 hover:text-amber-200 transition-all flex items-center justify-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                View Risk Analysis ({riskExplanations.length} hazards explained)
              </button>
            )}
            {!showSafeDestinations && (
              <button onClick={() => setShowSafeDestinations(true)}
                className="btn-press w-full py-2.5 rounded-xl text-xs font-semibold glass-panel border-emerald-500/15 text-emerald-300 hover:text-emerald-200 transition-all flex items-center justify-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
                Find Safe Destinations Nearby
              </button>
            )}
          </>
        )}

        {stage === "drive" && routes.length > 0 && (
          <DrivePanel
            route={routes[0]}
            fromName={CHENNAI_PRESETS[selectedFrom]?.name ?? "Origin"}
            toName={CHENNAI_PRESETS[selectedTo]?.name ?? "Destination"}
            onPositionChange={useGPS ? () => {} : setDriverPos}
            onAnnounce={handleAnnounce} onStop={handleStop} onComplete={handleComplete}
            onDangerUpdate={handleDangerUpdate} dangerMode={dangerMode}
          />
        )}

        {stage === "receipt" && (
          <ReceiptPanel hazardsHit={summary.hazardsHit} risk={summary.risk}
            onNewTrip={() => { setStage("plan"); setEmergencyServices([]); setShowEmergency(false); setShowReportForm(false); setShowRiskExplainer(false); }}
            tripMeta={{ from: CHENNAI_PRESETS[selectedFrom]?.name ?? "Unknown", to: CHENNAI_PRESETS[selectedTo]?.name ?? "Unknown", weather: selectedWeather, hour: selectedHour, routeId: routes[0]?.id ?? "r0" }}
          />
        )}
      </aside>

      <VoiceBanner text={voice} />
    </div>
  );
}
