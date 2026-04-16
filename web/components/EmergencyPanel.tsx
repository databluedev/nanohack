"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchEmergencyNearby, sendEmergencyAlert } from "@/lib/api";
import type { EmergencyService, EmergencyAlert, LatLng } from "@/lib/types";

type Props = {
  position: LatLng | null;
  visible: boolean;
  onClose: () => void;
  onServicesLoaded?: (services: EmergencyService[]) => void;
};

const TYPE_ICON: Record<string, string> = {
  hospital: "\u{1F3E5}",
  police: "\u{1F693}",
  fire: "\u{1F692}",
};

const TYPE_LABEL: Record<string, string> = {
  hospital: "Hospital",
  police: "Police",
  fire: "Fire Station",
};

export function EmergencyPanel({ position, visible, onClose, onServicesLoaded }: Props) {
  const [services, setServices] = useState<EmergencyService[]>([]);
  const [alert, setAlert] = useState<EmergencyAlert | null>(null);
  const [loading, setLoading] = useState(false);
  const [alertSending, setAlertSending] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !position) return;
    setLoading(true);
    fetchEmergencyNearby({ lat: position[0], lng: position[1], radius_m: 10000 })
      .then((data) => {
        setServices(data.services);
        onServicesLoaded?.(data.services);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, position, onServicesLoaded]);

  async function handleAlert() {
    if (!position) return;
    setAlertSending(true);
    try {
      const result = await sendEmergencyAlert({
        lat: position[0],
        lng: position[1],
      });
      setAlert(result);
    } catch { /* ok */ }
    setAlertSending(false);
  }

  if (!visible) return null;

  const filtered = filter
    ? services.filter((s) => s.type === filter)
    : services;

  return (
    <Card className="bg-slate-950/90 backdrop-blur border-red-800/50 shadow-2xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="text-xl">{"\u{1F6A8}"}</span> Emergency Services
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={onClose} className="text-slate-400">
          Close
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Alert Button */}
        {!alert && (
          <Button
            onClick={handleAlert}
            disabled={alertSending || !position}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold"
          >
            {alertSending
              ? "Sending Alert..."
              : "\u{1F6A8} Send Emergency Alert (Simulated)"}
          </Button>
        )}

        {/* Alert Confirmation */}
        {alert && (
          <div className="bg-emerald-900/40 border border-emerald-600/40 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wider text-emerald-400 font-bold mb-2">
              Alert Sent Successfully
            </div>
            <div className="space-y-1">
              {alert.notified.map((n, i) => (
                <div key={i} className="text-xs text-slate-300 flex items-center gap-2">
                  <span>{TYPE_ICON[n.type] ?? "\u{2753}"}</span>
                  <span className="flex-1">{n.service}</span>
                  <span className="text-slate-500">{n.distance_km} km</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter buttons */}
        <div className="flex gap-1">
          {[null, "hospital", "police", "fire"].map((t) => (
            <button
              key={t ?? "all"}
              onClick={() => setFilter(t)}
              className={`text-[11px] px-2 py-1 rounded-full border transition-all ${
                filter === t
                  ? "bg-blue-600/30 border-blue-500/50 text-blue-300"
                  : "bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white"
              }`}
            >
              {t ? `${TYPE_ICON[t]} ${TYPE_LABEL[t]}` : "All"}
            </button>
          ))}
        </div>

        {/* Services List */}
        {loading ? (
          <div className="text-xs text-slate-500 text-center py-4">
            Finding nearby services...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-xs text-slate-500 text-center py-4">
            No services found nearby
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {filtered.slice(0, 10).map((s, i) => (
              <div
                key={i}
                className="bg-slate-900/60 rounded-lg p-2 flex items-start gap-2"
              >
                <span className="text-lg mt-0.5">
                  {TYPE_ICON[s.type] ?? "\u{2753}"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-xs truncate">{s.name}</div>
                  <div className="text-[11px] text-slate-400">
                    {s.distance_km} km away
                    {s.phone && (
                      <>
                        {" "}
                        · <span className="text-blue-400">{s.phone}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 uppercase">
                  {TYPE_LABEL[s.type]}
                </div>
              </div>
            ))}
          </div>
        )}

        {!position && (
          <div className="text-xs text-amber-400 text-center">
            Start a trip to enable location-based services
          </div>
        )}
      </CardContent>
    </Card>
  );
}
