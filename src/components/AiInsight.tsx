import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sparkles, Droplet, Loader2 } from "lucide-react";

interface AiInsightProps {
  oilId: string;
  oilTitle: string;
}

const MOCK_INSIGHT = `В ваших записях прослеживается глубокая тема **внутренней честности**. Вы начинаете замечать, как тело реагирует на ситуации раньше, чем разум успевает их осмыслить.

Ключевые паттерны:
• Состояние тревоги чаще возникает в моменты, когда вы откладываете важный разговор
• Спокойствие приходит после того, как вы позволяете себе «просто быть»
• Энергия растёт, когда вы следуете за интересом, а не за «надо»

💡 **Инсайт:** Ваше тело уже знает ответы. Попробуйте в следующий раз, когда почувствуете напряжение, задать себе вопрос: «Что я сейчас не говорю?»`;

export function AiInsight({ oilId, oilTitle }: AiInsightProps) {
  const { user } = useAuth();
  const [insight, setInsight] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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

  const remaining = Math.max(0, 3 - entryCount);
  const canGenerate = entryCount >= 3;

  const handleGenerate = async () => {
    setIsGenerating(true);
    // Mock 3-second "thinking"
    await new Promise((r) => setTimeout(r, 3000));
    setInsight(MOCK_INSIGHT);
    setIsGenerating(false);
  };

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

  // Result or generate button
  return (
    <div className="space-y-6">
      {insight ? (
        <div className="relative overflow-hidden rounded-3xl border border-white/25 p-8 space-y-5"
          style={{
            background: "linear-gradient(135deg, hsla(263,50%,92%,0.6) 0%, hsla(0,0%,100%,0.5) 50%, hsla(20,90%,88%,0.4) 100%)",
            backdropFilter: "blur(24px)",
            boxShadow: "0 8px 40px hsla(263,72%,52%,0.1), 0 0 60px hsla(263,72%,52%,0.05), inset 0 1px 0 hsla(0,0%,100%,0.5)",
          }}
        >
          {/* Glow accent */}
          <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
              <Droplet className="h-5 w-5 text-primary" strokeWidth={1.5} />
            </div>
            <h3 className="font-serif text-lg font-semibold tracking-wide text-foreground">
              Глубокий инсайт
            </h3>
          </div>

          <div className="relative text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {insight.split(/(\*\*.*?\*\*)/g).map((part, i) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </div>

          <Button
            variant="ghost"
            onClick={handleGenerate}
            className="rounded-full gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Сгенерировать заново
          </Button>
        </div>
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
              У вас {entryCount} {entryCount >= 5 ? "записей" : "записи"} — достаточно для глубокого инсайта
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
    </div>
  );
}
