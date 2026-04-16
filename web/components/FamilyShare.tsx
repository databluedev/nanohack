"use client";

import { useState, useCallback } from "react";
import { startTripSession } from "@/lib/api";
import type { LatLng, Route } from "@/lib/types";

type Props = {
  route: Route;
  fromName: string;
  toName: string;
  tripId: string;
  onShareCreated?: (shareId: string) => void;
};

export function FamilyShareButton({ route, fromName, toName, tripId, onShareCreated }: Props) {
  const [shareId, setShareId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      const result = await startTripSession({
        trip_id: tripId,
        from_name: fromName,
        to_name: toName,
        polyline: route.polyline,
        weather: route.assessment.context.weather,
        risk: route.assessment.total_risk,
      });
      setShareId(result.share_id);
      onShareCreated?.(result.share_id);

      // Try native share
      const shareUrl = `${window.location.origin}/family/${result.share_id}`;
      if (navigator.share) {
        try {
          await navigator.share({
            title: "Track my trip — SafeRoute AI",
            text: `I'm driving from ${fromName} to ${toName}. Track me live:`,
            url: shareUrl,
          });
        } catch { /* cancelled */ }
      } else {
        // Copy to clipboard
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    } catch { /* ok */ }
    setSharing(false);
  }, [route, fromName, toName, tripId, onShareCreated]);

  return (
    <button
      onClick={handleShare}
      disabled={sharing}
      className="btn-press flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700/30 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
    >
      {copied ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-emerald-400"><polyline points="20 6 9 17 4 12"/></svg>
          <span className="text-emerald-400">Link Copied</span>
        </>
      ) : sharing ? (
        <span>Sharing...</span>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          <span>Share with Family</span>
        </>
      )}
    </button>
  );
}
