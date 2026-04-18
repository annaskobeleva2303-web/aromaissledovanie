import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { DiaryForm } from "@/components/DiaryForm";
import type { Oil } from "@/hooks/useOils";

const RESEARCH_DAYS = 21;

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

  const progress = Math.min((counts.days / RESEARCH_DAYS) * 100, 100);
  const streakLabel = counts.days === 1 ? "день" : counts.days < 5 ? "дня" : "дней";

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-secondary" strokeWidth={1.8} />
            {counts.days} {streakLabel} из {RESEARCH_DAYS}
          </span>
          <span className="font-medium text-primary">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-1 bg-muted" />
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
