"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { submitCommunityReport } from "@/lib/api";
import type { LatLng, CommunityReport as CRType } from "@/lib/types";

type Props = {
  position: LatLng | null;
  onReportSubmitted?: (report: CRType) => void;
  onClose: () => void;
};

const REPORT_TYPES: Record<string, string> = {
  pothole: "Pothole",
  blind_turn: "Blind Turn",
  accident_spot: "Accident Spot",
  waterlogging: "Waterlogging",
  construction: "Construction",
  other: "Other Hazard",
};

const REPORT_ICONS: Record<string, string> = {
  pothole: "\u{1F6A7}",
  blind_turn: "\u{21A9}\u{FE0F}",
  accident_spot: "\u{26A0}\u{FE0F}",
  waterlogging: "\u{1F30A}",
  construction: "\u{1F3D7}\u{FE0F}",
  other: "\u{2753}",
};

export function CommunityReportPanel({ position, onReportSubmitted, onClose }: Props) {
  const [type, setType] = useState("pothole");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!position) return;
    setSubmitting(true);
    try {
      const report = await submitCommunityReport({
        lat: position[0],
        lng: position[1],
        report_type: type,
        description,
        severity,
      });
      onReportSubmitted?.(report);
      setSubmitted(true);
      setTimeout(() => { setSubmitted(false); onClose(); }, 2000);
    } catch { /* ok */ }
    setSubmitting(false);
  }

  return (
    <Card className="bg-slate-950/90 backdrop-blur border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {"\u{1F4E2}"} Report Hazard
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={onClose} className="text-slate-400">
          Close
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {submitted ? (
          <div className="bg-emerald-900/40 border border-emerald-600/40 rounded-lg p-3 text-center">
            <div className="text-sm text-emerald-300 font-semibold">Report submitted! Thanks for keeping roads safer.</div>
          </div>
        ) : (
          <>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Hazard Type</div>
              <Select value={type} onValueChange={(v) => v && setType(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v) => `${REPORT_ICONS[v as string] ?? ""} ${REPORT_TYPES[v as string] ?? v}`}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REPORT_TYPES).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{REPORT_ICONS[k]} {label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Description (optional)</div>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Deep pothole on left lane"
                className="text-xs"
              />
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Severity</div>
              <div className="flex gap-2">
                {[1, 2, 3].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSeverity(s)}
                    className={`flex-1 py-1.5 rounded text-xs font-semibold transition ${
                      severity === s
                        ? s === 1 ? "bg-amber-600 text-white" : s === 2 ? "bg-orange-600 text-white" : "bg-red-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    {s === 1 ? "Low" : s === 2 ? "Medium" : "High"}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || !position}
              className="w-full"
            >
              {submitting ? "Submitting..." : "Submit Report"}
            </Button>

            {!position && (
              <div className="text-xs text-amber-400 text-center">
                Start a trip to enable location-based reporting
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
