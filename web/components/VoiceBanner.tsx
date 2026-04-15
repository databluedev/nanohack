"use client";

type Props = { text: string | null };

export function VoiceBanner({ text }: Props) {
  if (!text) return null;
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[1100] max-w-md w-[92%] sm:w-auto rounded-xl border border-amber-500/40 bg-slate-950/90 backdrop-blur px-5 py-3 shadow-2xl text-center animate-in slide-in-from-top duration-300">
      <div className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">
        ⚠ Risk Co-Pilot
      </div>
      <div className="text-sm mt-1 text-slate-100">{text}</div>
    </div>
  );
}
