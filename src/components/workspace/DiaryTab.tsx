import { DiaryCalendar } from "@/components/DiaryCalendar";
import type { Oil } from "@/hooks/useOils";

interface DiaryTabProps {
  oil: Oil;
}

export function DiaryTab({ oil }: DiaryTabProps) {
  return (
    <div className="space-y-6">
      <h2 className="font-serif text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Дневник практики
      </h2>
      <DiaryCalendar oilId={oil.id} viewOnly />
    </div>
  );
}
