import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Users, ArrowRight, ArrowLeft, Sparkles, Heart } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const MOODS = [
  { value: "calm", label: "Спокойствие", emoji: "😌" },
  { value: "anxious", label: "Тревога", emoji: "😟" },
  { value: "joyful", label: "Радость", emoji: "😊" },
  { value: "sad", label: "Грусть", emoji: "😢" },
  { value: "energetic", label: "Энергия", emoji: "⚡" },
  { value: "irritated", label: "Раздражение", emoji: "😤" },
  { value: "reflective", label: "Задумчивость", emoji: "🤔" },
  { value: "grateful", label: "Благодарность", emoji: "🙏" },
];

const ENERGY_TAGS = [
  { value: "support", label: "Опора", emoji: "🏔️" },
  { value: "transformation", label: "Трансформация", emoji: "🦋" },
  { value: "release", label: "Отпускание", emoji: "🍃" },
  { value: "expansion", label: "Расширение", emoji: "✨" },
  { value: "silence", label: "Тишина", emoji: "🌙" },
];

const STEP_TITLES = [
  "Что ты чувствуешь сейчас?",
  "Как сегодня звучит Давана?",
  "Твои смыслы и наблюдения...",
  "Твой инсайт от Даваны ✨",
];

const STEP_SUBTITLES = [
  "Вход в состояние",
  "Энергия Масла",
  "Свободный полёт",
  "Послание Даваны",
];

interface DiaryFormProps {
  oilId: string;
  date?: string;
  onSaved?: () => void;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

export function DiaryForm({ oilId, date, onSaved }: DiaryFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedEnergy, setSelectedEnergy] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [insightText, setInsightText] = useState<string | null>(null);

  const toggleMood = (value: string) => {
    setSelectedMoods((prev) =>
      prev.includes(value)
        ? prev.filter((m) => m !== value)
        : prev.length < 2
          ? [...prev, value]
          : [prev[1], value]
    );
  };

  const toggleEnergy = (value: string) => {
    setSelectedEnergy((prev) =>
      prev.includes(value)
        ? prev.filter((e) => e !== value)
        : [...prev, value]
    );
  };

  const goNext = () => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, 2));
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  };

  const finishSession = () => {
    setSelectedMoods([]);
    setSelectedEnergy([]);
    setContent("");
    setIsPublic(false);
    setInsightText(null);
    setStep(0);
    queryClient.invalidateQueries({ queryKey: ["entries", oilId] });
    queryClient.invalidateQueries({ queryKey: ["public-entries", oilId] });
    queryClient.invalidateQueries({ queryKey: ["ai-insights-history", oilId] });
    queryClient.invalidateQueries({ queryKey: ["entries-count", oilId] });
    onSaved?.();
  };

  const { mutate: saveEntry, isPending } = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      // Save entry
      const { error } = await supabase.from("entries").insert({
        user_id: user.id,
        oil_id: oilId,
        mood: selectedMoods[0] || null,
        content: content.trim(),
        is_public: isPublic,
        energy_tags: selectedEnergy,
        ...(date ? { date } : {}),
      });
      if (error) throw error;

      // Generate AI insight
      let insight: string | null = null;
      try {
        const { data, error: fnError } = await supabase.functions.invoke("generate-insight", {
          body: { oilId },
        });
        if (!fnError && data?.insight) {
          insight = data.insight;
        }
      } catch {
        // AI is optional
      }
      return insight;
    },
    onSuccess: (insight) => {
      toast.success("Запись сохранена ✨");
      if (insight) {
        setInsightText(insight);
        setDirection(1);
        setStep(3);
      } else {
        finishSession();
      }
    },
    onError: () => {
      toast.error("Не удалось сохранить запись");
    },
  });

  const canSave = content.trim().length > 0;
  const totalSteps = insightText !== null ? 4 : 3;

  // Alchemy loading overlay (shown during save + AI generation)
  if (isPending) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-12 flex flex-col items-center justify-center gap-6"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="h-10 w-10 text-primary" />
        </motion.div>
        <p className="font-serif text-lg tracking-wide text-foreground/80">
          Алхимия инсайта...
        </p>
        <p className="text-xs text-muted-foreground">
          Ваш опыт трансформируется в мудрость
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                i === step
                  ? "w-8 bg-primary shadow-md shadow-primary/30"
                  : i < step
                    ? "w-2 bg-primary/50"
                    : "w-2 bg-foreground/10"
              }`}
            />
          </div>
        ))}
      </div>

      {/* Step label */}
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-primary/60 font-medium">
          {STEP_SUBTITLES[step]}
        </p>
        <h3 className="mt-1 font-serif text-lg tracking-wide text-foreground/90">
          {STEP_TITLES[step]}
        </h3>
      </div>

      {/* Step content */}
      <div className="relative min-h-[280px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {step === 0 && (
              <div className="glass-card p-6">
                <p className="mb-4 text-xs text-muted-foreground tracking-wide">
                  Выбери 1–2 состояния
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {MOODS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => toggleMood(m.value)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm transition-all duration-300 ${
                        selectedMoods.includes(m.value)
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 -translate-y-0.5 scale-105"
                          : "bg-white/40 text-foreground/70 hover:bg-white/60 hover:-translate-y-0.5 hover:shadow-sm backdrop-blur-sm"
                      }`}
                    >
                      <span className="text-base">{m.emoji}</span>
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="glass-card p-6">
                <p className="mb-4 text-xs text-muted-foreground tracking-wide">
                  Что откликается сегодня?
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {ENERGY_TAGS.map((e) => (
                    <button
                      key={e.value}
                      type="button"
                      onClick={() => toggleEnergy(e.value)}
                      className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm transition-all duration-300 ${
                        selectedEnergy.includes(e.value)
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 -translate-y-0.5 scale-105"
                          : "bg-white/40 text-foreground/70 hover:bg-white/60 hover:-translate-y-0.5 hover:shadow-sm backdrop-blur-sm"
                      }`}
                    >
                      <span className="text-lg">{e.emoji}</span>
                      <span>{e.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="glass-card p-5">
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Позволь словам течь свободно. Что масло открывает тебе сегодня?"
                    className="min-h-[200px] resize-none rounded-2xl border-0 bg-transparent px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground/40 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>

                {/* Share toggle */}
                <div className="glass-card p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 text-primary/60" strokeWidth={1.5} />
                      <Label
                        htmlFor="is-public"
                        className="text-sm font-medium tracking-wide text-foreground/80 cursor-pointer"
                      >
                        Поделиться анонимно
                      </Label>
                    </div>
                    <Switch
                      id="is-public"
                      checked={isPublic}
                      onCheckedChange={setIsPublic}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Insight reveal */}
            {step === 3 && insightText && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="space-y-5"
              >
                <div className="relative overflow-hidden rounded-3xl border border-white/30 bg-white/50 p-6 shadow-xl shadow-primary/5 backdrop-blur-2xl">
                  {/* Decorative glow */}
                  <div className="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-accent/15 blur-3xl" />

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.8 }}
                    className="relative"
                  >
                    <Sparkles className="mx-auto mb-4 h-6 w-6 text-primary/60" />
                    <div className="max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
                      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/85 font-light">
                        {insightText}
                      </p>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 0 && step < 3 && (
          <Button
            variant="ghost"
            onClick={goBack}
            className="rounded-full gap-2 py-5 text-sm text-muted-foreground transition-all duration-300 hover:-translate-y-0.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Button>
        )}

        {step < 2 ? (
          <Button
            onClick={goNext}
            className="flex-1 rounded-full gap-2 py-5 text-sm tracking-wide transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/20"
          >
            Далее
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : step === 2 ? (
          <Button
            onClick={() => saveEntry()}
            disabled={!canSave || isPending}
            className="flex-1 rounded-full gap-2 py-5 text-sm tracking-wide transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/20"
          >
            <Sparkles className="h-4 w-4" />
            Алхимия инсайта
          </Button>
        ) : (
          <Button
            onClick={finishSession}
            className="flex-1 rounded-full gap-2 py-5 text-sm tracking-wide transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/20"
          >
            <Heart className="h-4 w-4" />
            Благодарю
          </Button>
        )}
      </div>
    </div>
  );
}
