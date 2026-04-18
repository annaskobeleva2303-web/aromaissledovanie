import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { OilCard } from "@/components/OilCard";
import { DiaryForm } from "@/components/DiaryForm";
import type { Oil } from "@/hooks/useOils";

interface PracticeTabProps {
  oil: Oil;
}

export function PracticeTab({ oil }: PracticeTabProps) {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: counts = { days: 0, hasToday: false } } = useQuery({
    queryKey: ["practice-progress", oil.id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("entries")
        .select("date")
        .eq("oil_id", oil.id)
        .eq("user_id", user!.id);
      const dates = new Set((data ?? []).map((e: { date: string }) => e.date));
      return { days: dates.size, hasToday: dates.has(today) };
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-4 font-serif text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Текущее исследование
        </h2>
        <OilCard oil={oil} daysCompleted={counts.days} />
      </section>

      {!counts.hasToday && (
        <section>
          <h2 className="mb-4 font-serif text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Сегодняшняя практика
          </h2>
          <DiaryForm oilId={oil.id} date={today} onSaved={() => {}} />
        </section>
      )}

      {counts.hasToday && (
        <div className="glass-card p-6 text-center">
          <p className="font-serif text-base text-foreground">
            Сегодняшняя практика завершена ✨
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Загляни во вкладку «Дневник», чтобы увидеть запись
          </p>
        </div>
      )}
    </div>
  );
}
