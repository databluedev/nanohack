"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  hazardsHit: number;
  risk: number;
  onNewTrip: () => void;
};

export function ReceiptPanel({ hazardsHit, risk, onNewTrip }: Props) {
  return (
    <Card className="bg-slate-950/80 backdrop-blur border-slate-800">
      <CardHeader>
        <CardTitle className="text-base">Trip Complete ✓</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="bg-slate-900/60 rounded-lg p-3">
          <div className="text-xs text-slate-400">Route Risk Score</div>
          <div className="text-3xl font-bold mt-1">{Math.round(risk)}</div>
        </div>
        <div className="bg-slate-900/60 rounded-lg p-3">
          <div className="text-xs text-slate-400">Hazards Encountered</div>
          <div className="text-3xl font-bold mt-1">{hazardsHit}</div>
          <div className="text-xs text-slate-400 mt-1">
            warnings issued during trip
          </div>
        </div>
        <Button onClick={onNewTrip} className="w-full">
          New Trip
        </Button>
      </CardContent>
    </Card>
  );
}
