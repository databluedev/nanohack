"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CHENNAI_PRESETS, DEMO_ROUTES } from "@/lib/presets";
import { fetchRoutes, fetchWindow, fetchChennaiWeather } from "@/lib/api";
import { getTripInsight } from "@/lib/tripMemory";
import type { Route, Weather, WindowResult, LiveWeather, RouteMode } from "@/lib/types";
import { RiskBadge } from "@/components/RiskBadge";

function labelFor(v: unknown): string {
  if (v == null) return "";
  const i = parseInt(String(v));
  return CHENNAI_PRESETS[i]?.name ?? "";
}

const WEATHER_LABEL: Record<string, string> = {
  clear: "Clear", cloudy: "Cloudy", rain: "Rain", heavy_rain: "Heavy Rain", fog: "Fog",
};

const WEATHER_ICON: Record<string, string> = {
  clear: "\u2600\uFE0F", cloudy: "\u2601\uFE0F", rain: "\uD83C\uDF27\uFE0F", heavy_rain: "\u26C8\uFE0F", fog: "\uD83C\uDF2B\uFE0F",
};

type Props = {
  onRoutes: (routes: Route[]) => void;
  onChooseRoute: (idx: number) => void;
  routes: Route[];
  chosenIdx: number;
  onStart: () => void;
};

export function PlanPanel({ onRoutes, onChooseRoute, routes, chosenIdx, onStart }: Props) {
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(5);
  const [weather, setWeather] = useState<Weather>("rain");
  const [hour, setHour] = useState(18);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [windowData, setWindowData] = useState<WindowResult | null>(null);
  const [routeMode, setRouteMode] = useState<RouteMode>("safest");
  const [liveWeather, setLiveWeather] = useState<LiveWeather | null>(null);
  const [useRealWeather, setUseRealWeather] = useState(false);
  const [tripInsight, setTripInsight] = useState<string | null>(null);

  useEffect(() => { fetchChennaiWeather().then((w) => setLiveWeather(w)).catch(() => {}); }, []);
  useEffect(() => {
    const from = CHENNAI_PRESETS[fromIdx]?.name;
    const to = CHENNAI_PRESETS[toIdx]?.name;
    if (from && to) setTripInsight(getTripInsight(from, to));
  }, [fromIdx, toIdx]);

  function buildDeparture(): string {
    const d = new Date();
    d.setHours(hour, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  }

  function effectiveWeather(): Weather {
    return useRealWeather && liveWeather ? liveWeather.category : weather;
  }

  async function handleFind() {
    setLoading(true); setError(null); setWindowData(null);
    try {
      const dep = buildDeparture();
      const w = effectiveWeather();
      const data = await fetchRoutes({ from: CHENNAI_PRESETS[fromIdx], to: CHENNAI_PRESETS[toIdx], departure: dep, weather: w });
      let sorted = [...data.routes];
      if (routeMode === "fastest") sorted.sort((a, b) => a.duration_s - b.duration_s);
      else if (routeMode === "safest") sorted.sort((a, b) => a.assessment.total_risk - b.assessment.total_risk);
      else sorted.sort((a, b) => (a.assessment.total_risk * 0.6 + a.duration_s / 60 * 0.4) - (b.assessment.total_risk * 0.6 + b.duration_s / 60 * 0.4));
      if (sorted.length > 0) sorted[0].recommended = true;
      onRoutes(sorted);
      if (sorted.length > 0) { const win = await fetchWindow({ polyline: sorted[0].polyline, weather: w, base: dep }); setWindowData(win); }
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  return (
    <div className="glass-panel rounded-2xl">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div>
            <div className="font-semibold text-sm">Plan a Trip</div>
            <div className="text-[10px] text-slate-500">Risk-aware route planning</div>
          </div>
        </div>
      </div>

      <div className="px-5 pb-5 space-y-3.5">
        {/* Quick demo routes */}
        {routes.length === 0 && (
          <div>
            <div className="text-[10px] text-slate-500 font-medium mb-1.5 uppercase tracking-wider">Quick Demo Routes</div>
            <div className="space-y-1">
              {DEMO_ROUTES.map((demo, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setFromIdx(demo.from);
                    setToIdx(demo.to);
                    setWeather(demo.weather);
                    setHour(demo.hour);
                  }}
                  className="btn-press w-full text-left surface-raised px-3 py-2 hover:bg-slate-800/30 transition"
                >
                  <div className="text-xs font-semibold text-slate-300">{demo.name}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{demo.highlight}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Live weather */}
        {liveWeather && liveWeather.source !== "fallback" && (
          <div className="surface-raised px-3 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <span>{WEATHER_ICON[liveWeather.category] ?? ""}</span>
              <span className="text-blue-300">{liveWeather.label}</span>
              {liveWeather.temperature_c != null && <span className="text-slate-500">{liveWeather.temperature_c}&deg;C</span>}
            </div>
            <button
              onClick={() => { setUseRealWeather(!useRealWeather); if (!useRealWeather && liveWeather) setWeather(liveWeather.category); }}
              className={`toggle-pill text-[9px] px-2.5 py-1 rounded-full border font-semibold uppercase tracking-wider ${
                useRealWeather ? "active bg-blue-600/20 border-blue-500/40 text-blue-300" : "bg-transparent border-slate-700 text-slate-600"
              }`}
            >
              {useRealWeather ? "Live" : "Use Live"}
            </button>
          </div>
        )}

        {/* Trip memory */}
        {tripInsight && (
          <div className="surface-raised px-3 py-2.5 border-blue-500/15">
            <div className="text-[9px] uppercase tracking-[0.15em] text-blue-400/70 font-semibold">Route Memory</div>
            <div className="text-[11px] text-blue-200/60 mt-0.5 leading-relaxed">{tripInsight}</div>
          </div>
        )}

        {/* From / To */}
        <div className="space-y-2">
          <div>
            <div className="text-[10px] text-slate-500 font-medium mb-1 uppercase tracking-wider">From</div>
            <Select value={String(fromIdx)} onValueChange={(v) => v != null && setFromIdx(parseInt(v))}>
              <SelectTrigger className="w-full bg-slate-900/50 border-slate-700/50"><SelectValue>{(v) => labelFor(v)}</SelectValue></SelectTrigger>
              <SelectContent>{CHENNAI_PRESETS.map((p, i) => <SelectItem key={i} value={String(i)}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-medium mb-1 uppercase tracking-wider">To</div>
            <Select value={String(toIdx)} onValueChange={(v) => v != null && setToIdx(parseInt(v))}>
              <SelectTrigger className="w-full bg-slate-900/50 border-slate-700/50"><SelectValue>{(v) => labelFor(v)}</SelectValue></SelectTrigger>
              <SelectContent>{CHENNAI_PRESETS.map((p, i) => <SelectItem key={i} value={String(i)}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {/* Weather + Hour */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] text-slate-500 font-medium mb-1 uppercase tracking-wider">Weather</div>
            <Select value={useRealWeather ? effectiveWeather() : weather} onValueChange={(v) => v && setWeather(v as Weather)} disabled={useRealWeather}>
              <SelectTrigger className="w-full bg-slate-900/50 border-slate-700/50"><SelectValue>{(v) => `${WEATHER_ICON[v as string] ?? ""} ${WEATHER_LABEL[v as string] ?? v}`}</SelectValue></SelectTrigger>
              <SelectContent>
                {Object.entries(WEATHER_LABEL).map(([k, label]) => <SelectItem key={k} value={k}>{WEATHER_ICON[k]} {label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-medium mb-1 uppercase tracking-wider">Departure</div>
            <Input type="number" min={0} max={23} value={hour} onChange={(e) => setHour(parseInt(e.target.value || "0"))} className="bg-slate-900/50 border-slate-700/50" />
          </div>
        </div>

        {/* Route Mode */}
        <div>
          <div className="text-[10px] text-slate-500 font-medium mb-1.5 uppercase tracking-wider">Route Priority</div>
          <div className="flex gap-1.5">
            {(["fastest", "balanced", "safest"] as RouteMode[]).map((mode) => {
              const active = routeMode === mode;
              const colors = mode === "fastest" ? "from-blue-600 to-blue-500" : mode === "balanced" ? "from-amber-600 to-amber-500" : "from-emerald-600 to-emerald-500";
              return (
                <button
                  key={mode}
                  onClick={() => setRouteMode(mode)}
                  className={`btn-press flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                    active ? `bg-gradient-to-r ${colors} text-white shadow-lg` : "bg-slate-800/50 text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {mode === "fastest" ? "Fast" : mode === "balanced" ? "Balanced" : "Safest"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Find button */}
        <button
          onClick={handleFind}
          disabled={loading}
          className="btn-press w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-900/30 hover:shadow-blue-900/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
              Computing...
            </span>
          ) : "Find Routes & Risk"}
        </button>

        {error && <div className="surface-raised px-3 py-2 text-xs text-red-400 border-red-500/20">{error}</div>}

        {/* Route cards */}
        {routes.length > 0 && (
          <div className="space-y-2 pt-1">
            {routes.map((r, i) => {
              const isChosen = i === chosenIdx;
              const riskPct = Math.min(100, r.assessment.total_risk);
              const riskColor = riskPct >= 60 ? "#ef4444" : riskPct >= 35 ? "#f59e0b" : "#10b981";
              return (
                <button
                  key={r.id}
                  onClick={() => onChooseRoute(i)}
                  className={`btn-press w-full text-left rounded-xl border p-3.5 transition-all ${
                    isChosen
                      ? "border-blue-500/40 bg-blue-950/20 shadow-lg shadow-blue-900/10"
                      : "border-slate-700/30 bg-slate-900/20 hover:border-slate-600/40 hover:bg-slate-800/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="font-semibold text-sm flex items-center gap-2">
                      Route {i + 1}
                      {i === 0 && (
                        <span className={`text-[9px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full font-bold ${
                          routeMode === "fastest" ? "bg-blue-500/15 text-blue-400 border border-blue-500/25"
                          : routeMode === "safest" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                          : "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                        }`}>
                          {routeMode === "fastest" ? "Fastest" : routeMode === "safest" ? "Safest" : "Best"}
                        </span>
                      )}
                    </div>
                    <RiskBadge score={r.assessment.total_risk} />
                  </div>

                  {/* Risk bar */}
                  <div className="w-full h-[3px] rounded-full bg-slate-800 mb-2 overflow-hidden">
                    <div className="risk-bar" style={{ width: `${riskPct}%`, background: riskColor }} />
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span>{r.assessment.length_km.toFixed(1)} km</span>
                    <span className="w-px h-3 bg-slate-700" />
                    <span>{Math.round(r.duration_s / 60)} min</span>
                    <span className="w-px h-3 bg-slate-700" />
                    <span>{r.assessment.waypoints.length} hazards</span>
                  </div>

                  {r.assessment.waypoints.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Array.from(new Set(r.assessment.waypoints.flatMap((w) => w.tags ?? []))).slice(0, 4).map((tag) => (
                        <span key={tag} className="text-[9px] bg-slate-800/60 text-slate-500 px-1.5 py-0.5 rounded-md border border-slate-700/30">{tag}</span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {windowData && <RiskWindowChart data={windowData} />}

        {routes.length > 0 && (
          <button
            onClick={onStart}
            className="btn-press w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-900/30 hover:shadow-emerald-900/50 transition-all"
          >
            Start Journey
          </button>
        )}
      </div>
    </div>
  );
}

function RiskWindowChart({ data }: { data: WindowResult }) {
  const max = Math.max(...data.slots.map((s) => s.risk), 1);
  return (
    <div className="pt-1">
      <div className="text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold mb-2">
        Risk Window &mdash; Next 6 Hours
      </div>
      <div className="surface-raised p-3">
        <div className="flex items-end gap-[3px] h-20">
          {data.slots.map((s) => {
            const h = Math.max(8, (s.risk / max) * 100);
            const color = s.risk >= 60 ? "#ef4444" : s.risk >= 35 ? "#f59e0b" : "#10b981";
            const isBest = data.best_slot && s.time === data.best_slot.time;
            return (
              <div key={s.time} className="flex-1 flex flex-col items-center" title={`${s.label}: risk ${s.risk}`}>
                <div
                  className="bar-chart-bar w-full rounded-t-sm"
                  style={{
                    height: `${h}%`,
                    background: isBest ? `linear-gradient(to top, ${color}, #34d399)` : color,
                    boxShadow: isBest ? `0 0 10px ${color}40` : undefined,
                    opacity: isBest ? 1 : 0.7,
                  }}
                />
                <div className="text-[8px] text-slate-600 mt-1 font-mono">{s.label}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="text-[11px] mt-2 text-emerald-400/80 flex items-center gap-1.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        {data.best_slot && data.saving_pct > 5
          ? `Leaving at ${data.best_slot.label} cuts risk by ${data.saving_pct}%`
          : "Current departure is near-optimal"}
      </div>
    </div>
  );
}
