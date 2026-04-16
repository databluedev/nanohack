"use client";

type Props = { text: string | null };

export function VoiceBanner({ text }: Props) {
  if (!text) return null;
  return (
    <div className="voice-banner fixed top-4 left-1/2 -translate-x-1/2 z-[1100] max-w-lg w-[90%] sm:w-auto">
      <div className="glass-panel rounded-2xl px-6 py-4 shadow-2xl border-amber-500/25">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-amber-400 text-sm">!</span>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-amber-400/80 font-semibold">
              Safety Co-Pilot
            </div>
            <div className="text-[13px] mt-1 text-slate-200 leading-relaxed">{text}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
