"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Props = {
  onTrigger: () => void;
  dangerMode?: boolean;
};

export function EmergencyButton({ onTrigger, dangerMode }: Props) {
  const [listening, setListening] = useState(false);
  const [confirmStep, setConfirmStep] = useState<"idle" | "confirm" | "sent">("idle");
  const recognitionRef = useRef<any>(null);
  const confirmTimerRef = useRef<number | null>(null);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch { /* ok */ } }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      const last = event.results[event.results.length - 1];
      if (!last.isFinal) return;
      const text = last[0].transcript.toLowerCase().trim();
      if (confirmStep === "idle" && (text.includes("emergency") || text.includes("help") || text.includes("sos"))) {
        setConfirmStep("confirm");
        speak("Do you want to alert emergency services? Say yes to confirm.");
      } else if (confirmStep === "confirm" && (text.includes("yes") || text.includes("confirm"))) {
        setConfirmStep("sent");
        onTrigger();
        speak("Emergency alert sent. Help is on the way.");
        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = window.setTimeout(() => setConfirmStep("idle"), 5000);
      } else if (confirmStep === "confirm" && (text.includes("no") || text.includes("cancel"))) {
        setConfirmStep("idle");
        speak("Emergency cancelled.");
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => { if (listening) { try { recognition.start(); } catch { /* ok */ } } };
    try { recognition.start(); recognitionRef.current = recognition; setListening(true); } catch { /* ok */ }
  }, [confirmStep, listening, onTrigger]);

  const toggleListening = useCallback(() => {
    if (listening) {
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch { /* ok */ } recognitionRef.current = null; }
      setListening(false);
    } else {
      startListening();
    }
  }, [listening, startListening]);

  const handleSOSPress = useCallback(() => {
    if (confirmStep === "idle") {
      setConfirmStep("confirm");
      speak("Do you want to alert emergency services? Tap SOS again to confirm.");
    } else if (confirmStep === "confirm") {
      setConfirmStep("sent");
      onTrigger();
      speak("Emergency alert sent. Help is on the way.");
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = window.setTimeout(() => setConfirmStep("idle"), 5000);
    }
  }, [confirmStep, onTrigger]);

  useEffect(() => () => {
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch { /* ok */ } }
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
  }, []);

  const isSent = confirmStep === "sent";
  const isConfirm = confirmStep === "confirm";

  return (
    <div className="flex flex-col items-center gap-2.5">
      {/* SOS Button with pulse ring */}
      <div className="relative">
        {/* Pulse rings */}
        {(dangerMode || isConfirm) && !isSent && (
          <>
            <div className="absolute inset-0 rounded-full bg-red-500/20 sos-ring" />
            <div className="absolute inset-0 rounded-full bg-red-500/10 sos-ring" style={{ animationDelay: "0.5s" }} />
          </>
        )}
        <button
          onClick={handleSOSPress}
          className={`btn-press relative z-10 rounded-full w-[68px] h-[68px] flex flex-col items-center justify-center shadow-2xl border-2 transition-all ${
            isSent
              ? "bg-emerald-600 border-emerald-400/40 shadow-emerald-900/40"
              : isConfirm
              ? "bg-amber-500 border-amber-300/40 shadow-amber-900/40 scale-110"
              : "bg-red-600 border-red-400/30 shadow-red-900/50 hover:scale-105"
          }`}
        >
          {isSent ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : isConfirm ? (
            <span className="text-white text-[9px] font-black tracking-wider leading-tight text-center">TAP TO<br/>CONFIRM</span>
          ) : (
            <>
              <span className="text-white font-black text-base tracking-wider">SOS</span>
            </>
          )}
        </button>
      </div>

      {/* Mic toggle */}
      <button
        onClick={toggleListening}
        className={`btn-press flex items-center gap-1.5 text-[10px] px-3 py-1 rounded-full border transition-all ${
          listening
            ? "bg-red-500/15 border-red-500/30 text-red-300"
            : "bg-slate-900/60 border-slate-700 text-slate-500 hover:text-slate-300"
        }`}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
        {listening ? "Listening" : "Voice"}
      </button>

      {/* Confirm / Sent cards */}
      {isConfirm && (
        <div className="glass-panel rounded-xl px-4 py-3 text-center max-w-[220px] stage-enter border-amber-500/20">
          <div className="text-[10px] uppercase tracking-[0.12em] text-amber-400 font-bold">Confirm Emergency?</div>
          <div className="text-[11px] text-slate-400 mt-1">Tap SOS again or say &ldquo;Yes&rdquo;</div>
          <button onClick={() => setConfirmStep("idle")} className="text-[10px] text-slate-600 mt-2 hover:text-slate-400 transition">Cancel</button>
        </div>
      )}
      {isSent && (
        <div className="glass-panel rounded-xl px-4 py-3 text-center max-w-[220px] stage-enter border-emerald-500/20">
          <div className="text-[10px] uppercase tracking-[0.12em] text-emerald-400 font-bold">Alert Sent</div>
          <div className="text-[11px] text-slate-400 mt-1">Emergency services notified</div>
        </div>
      )}
    </div>
  );
}

function speak(text: string) {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1; u.pitch = 1; u.volume = 1; window.speechSynthesis.speak(u); } catch { /* ok */ }
  }
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try { navigator.vibrate([200, 100, 200, 100, 200]); } catch { /* ok */ }
  }
}
