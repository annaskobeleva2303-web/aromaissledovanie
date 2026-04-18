import { AiInsight } from "@/components/AiInsight";
import type { Oil } from "@/hooks/useOils";

interface AnalyticsTabProps {
  oil: Oil;
}

export function AnalyticsTab({ oil }: AnalyticsTabProps) {
  return (
    <div className="space-y-6">
      <h2 className="font-serif text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Аналитика
      </h2>
      <AiInsight oilId={oil.id} oilTitle={oil.title} />
    </div>
  );
}
