"use client";

import { useState, useEffect } from "react";
import { fetchSafeDestinations } from "@/lib/api";
import type { LatLng, SafeDestination } from "@/lib/types";

type Props = {
  position: LatLng | null;
  onClose: () => void;
  onDestinationSelect?: (dest: SafeDestination) => void;
};

const CATEGORY_ICON: Record<string, string> = {
  fuel: "\u26FD", parking: "\u{1F17F}\uFE0F", food: "\u{1F37D}\uFE0F",
  hospital: "\u{1F3E5}", hotel: "\u{1F3E8}", shopping: "\u{1F6CD}\uFE0F",
  office: "\u{1F3E2}", other: "\u{1F4CD}",
};

const CATEGORY_LABEL: Record<string, string> = {
  fuel: "Fuel Station", parking: "Parking", food: "Restaurant",
  hospital: "Hospital", hotel: "Hotel", shopping: "Shopping",
  office: "Office", other: "Other",
};

export function SafeDestinations({ position, onClose, onDestinationSelect }: Props) {
  const [destinations, setDestinations] = useState<SafeDestination[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!position) return;
    setLoading(true);
    fetchSafeDestinations({ lat: position[0], lng: position[1], category: filter ?? undefined })
      .then((d) => setDestinations(d.destinations))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [position, filter]);

  return (
    <div className="glass-panel rounded-2xl stage-enter">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400">
              <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div>
            <span className="font-semibold text-sm">Safe Destinations</span>
            <div className="text-[10px] text-slate-500">Amenities in low-risk zones</div>
          </div>
        </div>
        <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-300 transition px-2 py-1">Close</button>
      </div>

      <div className="px-5 pb-5 space-y-3">
        {/* Category filters */}
        <div className="flex flex-wrap gap-1">
          {[null, "fuel", "parking", "food", "hospital"].map((cat) => (
            <button
              key={cat ?? "all"}
              onClick={() => setFilter(cat)}
              className={`toggle-pill text-[10px] px-2.5 py-1 rounded-full font-medium transition-all ${
                filter === cat ? "active bg-emerald-600/25 text-emerald-300" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {cat ? `${CATEGORY_ICON[cat] ?? ""} ${CATEGORY_LABEL[cat] ?? cat}` : "All"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-xs text-slate-500 text-center py-6">Searching safe destinations...</div>
        ) : destinations.length === 0 ? (
          <div className="text-xs text-slate-500 text-center py-6">No safe destinations found nearby</div>
        ) : (
          <div className="space-y-1.5 max-h-[350px] overflow-y-auto panel-scroll">
            {destinations.map((dest, i) => {
              const scoreColor = dest.safety_score >= 70 ? "text-emerald-400" : dest.safety_score >= 40 ? "text-amber-400" : "text-red-400";
              return (
                <button
                  key={i}
                  onClick={() => onDestinationSelect?.(dest)}
                  className="btn-press w-full text-left surface-raised px-3 py-2.5 hover:bg-slate-800/30 transition"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-lg mt-0.5">{CATEGORY_ICON[dest.category] ?? "\u{1F4CD}"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs truncate">{dest.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {dest.distance_km} km &middot; {CATEGORY_LABEL[dest.category] ?? dest.type}
                      </div>
                      {dest.safe_reasons.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {dest.safe_reasons.slice(0, 3).map((r) => (
                            <span key={r} className="text-[9px] bg-emerald-900/30 text-emerald-400/70 px-1.5 py-0.5 rounded">{r}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-sm font-bold ${scoreColor}`}>{dest.safety_score}</div>
                      <div className="text-[9px] text-slate-600 uppercase">safe</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {!position && (
          <div className="text-xs text-amber-400/70 text-center">
            Select a route or start a trip to search nearby
          </div>
        )}
      </div>
    </div>
  );
}
