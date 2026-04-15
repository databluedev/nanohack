import { Badge } from "@/components/ui/badge";

export function RiskBadge({ score }: { score: number }) {
  let label = "LOW";
  let cls = "bg-emerald-600 hover:bg-emerald-600 text-white border-transparent";
  if (score >= 60) {
    label = "HIGH";
    cls = "bg-red-600 hover:bg-red-600 text-white border-transparent";
  } else if (score >= 35) {
    label = "MED";
    cls = "bg-amber-500 hover:bg-amber-500 text-white border-transparent";
  }
  return (
    <Badge className={cls}>
      {label} · {Math.round(score)}
    </Badge>
  );
}
