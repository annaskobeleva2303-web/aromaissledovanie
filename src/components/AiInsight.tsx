import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sparkles, Droplet, Loader2, RefreshCw, ChevronLeft, ChevronRight, History, Trash2, CalendarDays, BarChart3 } from "lucide-react";

const MOOD_LABELS: Record<string, { label: string; emoji: string }> = {
  calm: { label: "Спокойствие", emoji: "😌" },
  anxious: { label: "Тревога", emoji: "😟" },
  joyful: { label: "Радость", emoji: "😊" },
  sad: { label: "Грусть", emoji: "😢" },
  energetic: { label: "Энергия", emoji: "⚡" },
  irritated: { label: "Раздражение", emoji: "😤" },
  reflective: { label: "Задумчивость", emoji: "🤔" },
  grateful: { label: "Благодарность", emoji: "🙏" },
};

const ENERGY_LABELS: Record<string, { label: string; emoji: string }> = {
  support: { label: "Опора", emoji: "🏔️" },
  transformation: { label: "Трансформация", emoji: "🦋" },
  release: { label: "Отпускание", emoji: "🍃" },
  expansion: { label: "Расширение", emoji: "✨" },
  silence: { label: "Тишина", emoji: "🌙" },
};
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AiInsightProps {
  oilId: string;
  oilTitle: string;
}

function InsightCard({
  content,
  createdAt,
  index,
  total,
  onPrev,
  onNext,
  onDelete,
}: {
  content: string;
  createdAt: string;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-white/25 p-8 space-y-5"
      style={{
        background:
          "linear-gradient(135deg, hsla(263,50%,92%,0.6) 0%, hsla(0,0%,100%,0.5) 50%, hsla(20,90%,88%,0.4) 100%)",
        backdropFilter: "blur(24px)",
        boxShadow:
          "0 8px 40px hsla(263,72%,52%,0.1), 0 0 60px hsla(263,72%,52%,0.05), inset 0 1px 0 hsla(0,0%,100%,0.5)",
      }}
    >
      <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
            <Droplet className="h-5 w-5 text-primary" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="font-serif text-lg font-semibold tracking-wide text-foreground">
              Глубокий инсайт
            </h3>
            {total > 1 && (
              <p className="text-xs text-muted-foreground/60">
                {index + 1} из {total}
              </p>
            )}
          </div>
        </div>

        {total > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrev}
              disabled={index === 0}
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNext}
              disabled={index === total - 1}
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="relative text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
        {content.split(/(\*\*.*?\*\*)/g).map((part, i) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={i} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </strong>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </div>

      <div className="relative flex items-center justify-between">
        <p className="text-xs text-muted-foreground/60">
          Сгенерировано:{" "}
          {new Date(createdAt).toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить инсайт?</AlertDialogTitle>
              <AlertDialogDescription>
                Этот анализ будет удалён навсегда. Отменить действие будет невозможно.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full">Отмена</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="rounded-full bg-destructive hover:bg-destructive/90">
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export function AiInsight({ oilId, oilTitle }: AiInsightProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [summaryIndex, setSummaryIndex] = useState(0);

  const { data: entryCount = 0 } = useQuery({
    queryKey: ["entries-count", oilId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("entries")
        .select("id", { count: "exact", head: true })
        .eq("oil_id", oilId)
        .eq("user_id", user!.id);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
  });

  // Load ALL saved insights (newest first)
  const { data: insights = [], isLoading: insightLoading } = useQuery({
    queryKey: ["ai-insights-history", oilId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_insights")
        .select("id, content, created_at")
        .eq("oil_id", oilId)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Load personal weekly summaries
  const { data: summaries = [] } = useQuery({
    queryKey: ["personal-summaries", oilId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_summaries")
        .select("id, summary_text, week_start, created_at")
        .eq("oil_id", oilId)
        .eq("user_id", user!.id)
        .order("week_start", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const remaining = Math.max(0, 3 - entryCount);
  const canGenerate = entryCount >= 3;

  const handleDelete = async (insightId: string) => {
    const { error } = await supabase
      .from("ai_insights")
      .delete()
      .eq("id", insightId)
      .eq("user_id", user!.id);
    if (error) {
      toast.error("Не удалось удалить инсайт");
      return;
    }
    toast.success("Инсайт удалён");
    setCurrentIndex((i) => Math.max(0, i - 1));
    queryClient.invalidateQueries({ queryKey: ["ai-insights-history", oilId] });
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-insight", {
        body: { oilId },
      });

      if (error) {
        console.error("Edge function error:", error);
        toast.error("Не удалось сгенерировать инсайт. Попробуйте позже.");
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setCurrentIndex(0);
      queryClient.invalidateQueries({ queryKey: ["ai-insights-history", oilId] });
    } catch (e) {
      console.error("Insight generation failed:", e);
      toast.error("Произошла ошибка при генерации инсайта.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-personal-summary", {
        body: { oilId },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setSummaryIndex(0);
      queryClient.invalidateQueries({ queryKey: ["personal-summaries", oilId] });
      toast.success("Еженедельное саммари готово ✨");
    } catch (e) {
      console.error("Summary generation failed:", e);
      toast.error("Не удалось сгенерировать саммари");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  if (insightLoading) {
    return (
      <div className="glass-card p-12 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary/50" />
      </div>
    );
  }

  // Not enough entries
  if (!canGenerate) {
    return (
      <div className="glass-card p-10 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" strokeWidth={1.5} />
        </div>
        <p className="font-serif text-lg font-medium tracking-wide text-foreground">
          Почти готово к анализу
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Для глубокого анализа нужно собрать чуть больше наблюдений.
          <br />
          Сделайте ещё{" "}
          <span className="font-semibold text-primary">
            {remaining} {remaining === 1 ? "запись" : remaining === 2 ? "записи" : "записей"}
          </span>
          , чтобы ИИ смог увидеть паттерны.
        </p>
      </div>
    );
  }

  // Generating state
  if (isGenerating) {
    return (
      <div className="glass-card p-12 text-center space-y-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 animate-pulse">
          <Sparkles className="h-7 w-7 text-primary" strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <p className="font-serif text-lg font-medium tracking-wide text-foreground">
            Синтезируем ваши смыслы…
          </p>
          <p className="text-sm text-muted-foreground animate-pulse">
            ИИ анализирует {entryCount} {entryCount >= 5 ? "записей" : "записи"} по «{oilTitle}»
          </p>
        </div>
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary/50" />
      </div>
    );
  }

  const currentInsight = insights[currentIndex];

  return (
    <div className="space-y-6">
      {currentInsight ? (
        <>
          <InsightCard
            content={currentInsight.content}
            createdAt={currentInsight.created_at}
            index={currentIndex}
            total={insights.length}
            onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            onNext={() => setCurrentIndex((i) => Math.min(insights.length - 1, i + 1))}
            onDelete={() => handleDelete(currentInsight.id)}
          />

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={handleGenerate}
              className="rounded-full gap-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Обновить анализ
            </Button>

            {insights.length > 1 && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
                <History className="h-3 w-3" />
                {insights.length} {insights.length === 1 ? "анализ" : insights.length < 5 ? "анализа" : "анализов"} в истории
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="glass-card p-10 text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" strokeWidth={1.5} />
          </div>
          <div className="space-y-2">
            <p className="font-serif text-lg font-medium tracking-wide text-foreground">
              Анализ готов к запуску
            </p>
            <p className="text-sm text-muted-foreground">
              У вас {entryCount} {entryCount >= 5 ? "записей" : "записи"} — достаточно для
              глубокого инсайта
            </p>
          </div>
          <Button
            onClick={handleGenerate}
            className="rounded-full gap-2 px-8 py-6 text-sm tracking-wide transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/20"
          >
            <Sparkles className="h-4 w-4" />
            Сгенерировать глубокий инсайт
          </Button>
        </div>
      )}

      {/* Weekly Personal Summary */}
      {canGenerate && (
        <div
          className="relative overflow-hidden rounded-3xl border border-white/25 p-8 space-y-5"
          style={{
            background:
              "linear-gradient(135deg, hsla(20,90%,88%,0.5) 0%, hsla(0,0%,100%,0.5) 50%, hsla(263,50%,92%,0.5) 100%)",
            backdropFilter: "blur(24px)",
            boxShadow:
              "0 8px 40px hsla(263,72%,52%,0.08), 0 0 60px hsla(20,90%,74%,0.05), inset 0 1px 0 hsla(0,0%,100%,0.5)",
          }}
        >
          <div className="absolute -top-20 -left-20 h-40 w-40 rounded-full bg-secondary/20 blur-3xl" />

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/20">
                <CalendarDays className="h-5 w-5 text-secondary-foreground" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-serif text-lg font-semibold tracking-wide text-foreground">
                  Итоги недели
                </h3>
                {summaries.length > 1 && (
                  <p className="text-xs text-muted-foreground/60">
                    {summaryIndex + 1} из {summaries.length}
                  </p>
                )}
              </div>
            </div>
            {summaries.length > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSummaryIndex((i) => Math.max(0, i - 1))}
                  disabled={summaryIndex === 0}
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSummaryIndex((i) => Math.min(summaries.length - 1, i + 1))}
                  disabled={summaryIndex === summaries.length - 1}
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {summaries.length > 0 ? (
            <>
              <div className="relative text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                {summaries[summaryIndex].summary_text.split(/(\*\*.*?\*\*)/g).map((part, i) =>
                  part.startsWith("**") && part.endsWith("**") ? (
                    <strong key={i} className="font-semibold text-foreground">
                      {part.slice(2, -2)}
                    </strong>
                  ) : (
                    <span key={i}>{part}</span>
                  )
                )}
              </div>
              <div className="relative flex items-center justify-between">
                <p className="text-xs text-muted-foreground/60">
                  Неделя с{" "}
                  {new Date(summaries[summaryIndex].week_start).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                  })}
                </p>
                <Button
                  variant="ghost"
                  onClick={handleGenerateSummary}
                  disabled={isGeneratingSummary}
                  className="rounded-full gap-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {isGeneratingSummary ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Обновить
                </Button>
              </div>
            </>
          ) : (
            <div className="relative text-center space-y-3 py-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Персональное еженедельное саммари появится здесь после генерации.
              </p>
              <Button
                onClick={handleGenerateSummary}
                disabled={isGeneratingSummary}
                variant="outline"
                className="rounded-full gap-2 text-sm border-white/30 bg-white/30 hover:bg-white/50"
              >
                {isGeneratingSummary ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CalendarDays className="h-4 w-4" />
                )}
                Сгенерировать итоги недели
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
