import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface IntroMeditationScreenProps {
  oilId: string;
  videoUrl: string;
  onBack: () => void;
  onCompleted: () => void;
}

export function IntroMeditationScreen({ oilId, videoUrl, onBack, onCompleted }: IntroMeditationScreenProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<"watching" | "writing">("watching");
  const [content, setContent] = useState("");

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Нет пользователя");
      if (!content.trim()) throw new Error("Поделись хотя бы одной мыслью");
      const { error } = await supabase.from("entries").insert({
        user_id: user.id,
        oil_id: oilId,
        content: content.trim(),
        record_type: "meditation_intro",
        date: format(new Date(), "yyyy-MM-dd"),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intro_meditation_done"] });
      queryClient.invalidateQueries({ queryKey: ["intro-meditation-entry"] });
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      queryClient.invalidateQueries({ queryKey: ["practice-progress"] });
      toast.success("Запись сохранена. Путь начат ✨");
      onCompleted();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Назад к практике
      </button>

      <header className="text-center space-y-1.5">
        <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          Медитация погружения
        </div>
        <h1 className="font-serif text-2xl text-foreground">Встреча с маслом</h1>
      </header>

      {phase === "watching" && (
        <section className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-white/30 bg-black/80 shadow-xl">
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe
                src={videoUrl}
                className="absolute inset-0 h-full w-full"
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                title="Медитация погружения"
              />
            </div>
          </div>
          <Button
            onClick={() => setPhase("writing")}
            className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 py-6 text-sm"
          >
            Я завершила медитацию и готова высказаться
          </Button>
        </section>
      )}

      {phase === "writing" && (
        <section className="space-y-4 glass-card p-5">
          <div className="space-y-1.5">
            <h2 className="font-serif text-lg text-foreground">
              Твои образы и чувства после первого погружения
            </h2>
            <p className="text-xs text-muted-foreground">
              Свободный поток — не редактируй, просто запиши то, что приходит.
            </p>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Образы, ощущения, слова, которые остались..."
            rows={8}
            className="bg-white/40 border-white/30 text-sm resize-none rounded-2xl"
          />
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setPhase("watching")}
              className="rounded-full"
              disabled={saveMutation.isPending}
            >
              Назад
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !content.trim()}
              className="flex-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Сохранить и начать путь
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
