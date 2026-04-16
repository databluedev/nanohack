import { Badge } from "@/components/ui/badge";

export function RiskBadge({ score }: { score: number }) {
  let label = "LOW";
  let cls = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20";
  if (score >= 60) {
    label = "HIGH";
    cls = "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/20";
  } else if (score >= 35) {
    label = "MED";
    cls = "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/20";
  }
  return (
    <Badge className={`${cls} font-semibold text-[11px] px-2.5 py-0.5`}>
      {label} {Math.round(score)}
    </Badge>
  );
}

export function RiskGauge({ score, size = 100 }: { score: number; size?: number }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 60 ? "#ef4444" : score >= 35 ? "#f59e0b" : "#10b981";
  const label = score >= 60 ? "HIGH" : score >= 35 ? "MED" : "LOW";

  return (
    <div className="risk-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          className="risk-gauge-track"
          cx={size / 2}
          cy={size / 2}
          r={r}
        />
        <circle
          className="risk-gauge-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="risk-gauge-value">
        <span className="text-2xl font-bold leading-none" style={{ color }}>
          {Math.round(score)}
        </span>
        <span className="text-[9px] uppercase tracking-widest mt-0.5 text-slate-500 font-semibold">
          {label}
        </span>
      </div>
    </div>
  );
}
