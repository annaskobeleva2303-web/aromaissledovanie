import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Flame, Sparkles, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { DiaryForm } from "@/components/DiaryForm";
import { IntroMeditationScreen } from "@/components/IntroMeditationScreen";
import type { Oil } from "@/hooks/useOils";

const RESEARCH_DAYS = 21;

interface PracticeTabProps {
  oil: Oil;
}

export function PracticeTab({ oil }: PracticeTabProps) {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  const [meditationOpen, setMeditationOpen] = useState(false);

  const { data: counts = { days: 0, hasToday: false } } = useQuery({
    queryKey: ["practice-progress", oil.id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("entries")
        .select("date,record_type")
        .eq("oil_id", oil.id)
        .eq("user_id", user!.id);
      const dailyDates = new Set(
        (data ?? [])
          .filter((e: any) => e.record_type !== "meditation_intro")
          .map((e: any) => e.date as string),
      );
      return { days: dailyDates.size, hasToday: dailyDates.has(today) };
    },
    enabled: !!user,
  });

  const introUrl = oil.intro_meditation_url ?? null;

  const { data: introDone } = useQuery({
    queryKey: ["intro_meditation_done", oil.id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("entries")
        .select("id")
        .eq("user_id", user!.id)
        .eq("oil_id", oil.id)
        .eq("record_type", "meditation_intro")
        .limit(1);
      return (data ?? []).length > 0;
    },
    enabled: !!user,
  });

  const showIntroCard = !!introUrl && introDone === false;

  const progress = Math.min((counts.days / RESEARCH_DAYS) * 100, 100);
  const streakLabel = counts.days === 1 ? "день" : counts.days < 5 ? "дня" : "дней";

  if (meditationOpen && introUrl) {
    return (
      <IntroMeditationScreen
        oilId={oil.id}
        videoUrl={introUrl}
        onBack={() => setMeditationOpen(false)}
        onCompleted={() => setMeditationOpen(false)}
      />
    );
  }

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

      {showIntroCard && (
        <button
          onClick={() => setMeditationOpen(true)}
          className="group relative w-full overflow-hidden rounded-3xl border border-white/30 bg-gradient-to-br from-primary/15 via-white/30 to-secondary/15 backdrop-blur-xl p-5 text-left shadow-lg hover:shadow-xl transition-all duration-500 hover:scale-[1.01]"
        >
          <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <div className="shrink-0 rounded-2xl bg-white/40 backdrop-blur-sm p-3 border border-white/40">
              <Sparkles className="h-5 w-5 text-primary" strokeWidth={1.6} />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary/80">
                Вступительная практика
              </p>
              <h3 className="font-serif text-base text-foreground">
                Медитация погружения: Встреча с {oil.title}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-2">
                Первое знакомство с маслом — мягкое погружение перед началом 21-дневного пути.
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-3 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      )}

      {!counts.hasToday && (
        <section>
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
