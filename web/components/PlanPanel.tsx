"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CHENNAI_PRESETS } from "@/lib/presets";

function labelFor(v: unknown): string {
  if (v == null) return "";
  const i = parseInt(String(v));
  return CHENNAI_PRESETS[i]?.name ?? "";
}

const WEATHER_LABEL: Record<string, string> = {
  clear: "Clear",
  cloudy: "Cloudy",
  rain: "Rain",
  heavy_rain: "Heavy Rain",
  fog: "Fog",
};
import { fetchRoutes, fetchWindow } from "@/lib/api";
import type { Route, Weather, WindowResult } from "@/lib/types";
import { RiskBadge } from "@/components/RiskBadge";

type Props = {
  onRoutes: (routes: Route[]) => void;
  onChooseRoute: (idx: number) => void;
  routes: Route[];
  chosenIdx: number;
  onStart: () => void;
};

export function PlanPanel({
  onRoutes,
  onChooseRoute,
  routes,
  chosenIdx,
  onStart,
}: Props) {
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(5);
  const [weather, setWeather] = useState<Weather>("rain");
  const [hour, setHour] = useState(18);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [windowData, setWindowData] = useState<WindowResult | null>(null);

  function buildDeparture(): string {
    const d = new Date();
    d.setHours(hour, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    // Naive local ISO so backend labels match user's clock
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  }

  async function handleFind() {
    setLoading(true);
    setError(null);
    setWindowData(null);
    try {
      const dep = buildDeparture();
      const data = await fetchRoutes({
        from: CHENNAI_PRESETS[fromIdx],
        to: CHENNAI_PRESETS[toIdx],
        departure: dep,
        weather,
      });
      onRoutes(data.routes);
      if (data.routes.length > 0) {
        const win = await fetchWindow({
          polyline: data.routes[0].polyline,
          weather,
          base: dep,
        });
        setWindowData(win);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="bg-slate-950/80 backdrop-blur border-slate-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="text-xl">🛡️</span> Plan a Trip
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs text-slate-400">From</Label>
          <Select
            value={String(fromIdx)}
            onValueChange={(v) => v != null && setFromIdx(parseInt(v))}
          >
            <SelectTrigger className="mt-1 w-full">
              <SelectValue>{(v) => labelFor(v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CHENNAI_PRESETS.map((p, i) => (
                <SelectItem key={i} value={String(i)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-slate-400">To</Label>
          <Select
            value={String(toIdx)}
            onValueChange={(v) => v != null && setToIdx(parseInt(v))}
          >
            <SelectTrigger className="mt-1 w-full">
              <SelectValue>{(v) => labelFor(v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CHENNAI_PRESETS.map((p, i) => (
                <SelectItem key={i} value={String(i)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-slate-400">Weather</Label>
            <Select value={weather} onValueChange={(v) => v && setWeather(v as Weather)}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue>{(v) => WEATHER_LABEL[v as string] ?? v}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clear">Clear</SelectItem>
                <SelectItem value="cloudy">Cloudy</SelectItem>
                <SelectItem value="rain">Rain</SelectItem>
                <SelectItem value="heavy_rain">Heavy Rain</SelectItem>
                <SelectItem value="fog">Fog</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-400">Departure (hr)</Label>
            <Input
              type="number"
              min={0}
              max={23}
              value={hour}
              onChange={(e) => setHour(parseInt(e.target.value || "0"))}
              className="mt-1"
            />
          </div>
        </div>

        <Button onClick={handleFind} disabled={loading} className="w-full">
          {loading ? "Computing risk..." : "Find Routes & Risk"}
        </Button>

        {error && <p className="text-xs text-red-400">{error}</p>}

        {routes.length > 0 && (
          <div className="space-y-2 pt-2">
            {routes.map((r, i) => {
              const isChosen = i === chosenIdx;
              return (
                <button
                  key={r.id}
                  onClick={() => onChooseRoute(i)}
                  className={`w-full text-left rounded-lg border p-3 transition ${
                    isChosen
                      ? "border-blue-500 bg-slate-900/80"
                      : "border-slate-800 bg-slate-900/40 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm flex items-center gap-2">
                      Route {i + 1}
                      {i === 0 && (
                        <span className="text-[10px] uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded">
                          Recommended
                        </span>
                      )}
                    </div>
                    <RiskBadge score={r.assessment.total_risk} />
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {r.assessment.length_km.toFixed(1)} km ·{" "}
                    {Math.round(r.duration_s / 60)} min ·{" "}
                    {r.assessment.waypoints.length} hazards
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {windowData && <RiskWindowChart data={windowData} />}

        {routes.length > 0 && (
          <Button
            onClick={onStart}
            variant="secondary"
            className="w-full mt-2 bg-emerald-700 hover:bg-emerald-600 text-white"
          >
            ▶ Start Journey (simulated)
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function RiskWindowChart({ data }: { data: WindowResult }) {
  const max = Math.max(...data.slots.map((s) => s.risk), 1);
  return (
    <div className="pt-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">
        Risk Window — next 6 hours
      </div>
      <div className="flex items-end gap-1 h-24 bg-slate-900/60 rounded-lg p-2">
        {data.slots.map((s) => {
          const h = Math.max(6, (s.risk / max) * 100);
          const color =
            s.risk >= 60 ? "#dc2626" : s.risk >= 35 ? "#f59e0b" : "#10b981";
          const isBest = data.best_slot && s.time === data.best_slot.time;
          return (
            <div
              key={s.time}
              className="flex-1 flex flex-col items-center"
              title={`${s.label}: risk ${s.risk}`}
            >
              <div
                style={{
                  height: `${h}%`,
                  background: color,
                  boxShadow: isBest ? "0 0 0 2px #34d399" : undefined,
                }}
                className="w-full rounded-t"
              />
              <div className="text-[9px] text-slate-400 mt-1">{s.label}</div>
            </div>
          );
        })}
      </div>
      <div className="text-xs mt-2 text-emerald-300">
        {data.best_slot && data.saving_pct > 5
          ? `💡 Leaving at ${data.best_slot.label} cuts risk by ${data.saving_pct}%`
          : "✓ Current departure is near-optimal"}
      </div>
    </div>
  );
}
