"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type Props = {
  active: boolean;
  onCrashDetected: () => void;
  onCountdownCancel: () => void;
};

export function CrashDetector({ active, onCrashDetected, onCountdownCancel }: Props) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [detected, setDetected] = useState(false);
  const timerRef = useRef<number | null>(null);
  const lastAccelRef = useRef<number>(0);
  const cooldownRef = useRef(false);

  const handleMotion = useCallback((e: DeviceMotionEvent) => {
    if (!active || cooldownRef.current) return;
    const acc = e.accelerationIncludingGravity;
    if (!acc) return;

    const magnitude = Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2);
    const delta = Math.abs(magnitude - lastAccelRef.current);
    lastAccelRef.current = magnitude;

    // Sudden deceleration: delta > 30 m/s^2 (severe impact threshold)
    if (delta > 30 && !detected) {
      setDetected(true);
      setCountdown(30);
      cooldownRef.current = true;

      // Speak warning
      if ("speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance("Possible crash detected. Emergency services will be contacted in 30 seconds. Tap cancel if you are okay.");
          u.rate = 1; u.pitch = 1; u.volume = 1;
          window.speechSynthesis.speak(u);
        } catch { /* ok */ }
      }
      if ("vibrate" in navigator) {
        try { navigator.vibrate([500, 200, 500, 200, 500]); } catch { /* ok */ }
      }
    }
  }, [active, detected]);

  useEffect(() => {
    if (!active) return;
    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [active, handleMotion]);

  // Countdown timer
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      onCrashDetected();
      setCountdown(null);
      setDetected(false);
      setTimeout(() => { cooldownRef.current = false; }, 60000);
      return;
    }
    timerRef.current = window.setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [countdown, onCrashDetected]);

  const handleCancel = useCallback(() => {
    setCountdown(null);
    setDetected(false);
    setTimeout(() => { cooldownRef.current = false; }, 10000);
    onCountdownCancel();
    if ("speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance("Cancelled. Glad you are okay."); window.speechSynthesis.speak(u); } catch { /* ok */ }
    }
  }, [onCountdownCancel]);

  if (countdown === null) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm stage-enter">
      <div className="glass-panel rounded-3xl p-8 max-w-sm w-[90%] text-center border-red-500/30 danger-glow">
        {/* Countdown circle */}
        <div className="risk-gauge mx-auto mb-4" style={{ width: 140, height: 140 }}>
          <svg width={140} height={140} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={70} cy={70} r={58} fill="none" stroke="rgba(220,38,38,0.15)" strokeWidth={10} />
            <circle cx={70} cy={70} r={58} fill="none" stroke="#ef4444" strokeWidth={10} strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 58}
              strokeDashoffset={2 * Math.PI * 58 * (1 - countdown / 30)}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div className="risk-gauge-value">
            <span className="text-5xl font-bold text-red-400">{countdown}</span>
            <span className="text-[10px] text-red-400/60 uppercase tracking-widest mt-1">seconds</span>
          </div>
        </div>

        <h2 className="text-lg font-bold text-red-300 mb-1">Crash Detected</h2>
        <p className="text-sm text-slate-400 mb-6">
          Emergency services will be contacted automatically.
          <br />Tap below if you are safe.
        </p>

        <button
          onClick={handleCancel}
          className="btn-press w-full py-4 rounded-2xl text-base font-bold bg-emerald-600 text-white shadow-xl shadow-emerald-900/40 hover:bg-emerald-500 transition-all"
        >
          I&apos;m Okay — Cancel
        </button>
      </div>
    </div>
  );
}
