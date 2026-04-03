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
import { SparkleBackground } from "@/components/SparkleBackground";

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

const SENSATIONS = [
  { value: "body", label: "В теле", emoji: "🧘‍♀️" },
  { value: "mind", label: "В мыслях", emoji: "🧠" },
  { value: "emotions", label: "В эмоциях", emoji: "✨" },
  { value: "unclear", label: "Сложно понять", emoji: "🌱" },
];

const ENERGY_TAGS = [
  { value: "support", label: "Опора", emoji: "🏔️" },
  { value: "transformation", label: "Трансформация", emoji: "🦋" },
  { value: "release", label: "Отпускание", emoji: "🍃" },
  { value: "expansion", label: "Расширение", emoji: "✨" },
  { value: "silence", label: "Тишина", emoji: "🌙" },
];

const STEP_TITLES = [
  "Что сейчас поднимает масло?",
  "Где это ощущается?",
  "Как сегодня звучит Давана?",
  "Проживи этот момент...",
  "Твой инсайт от Даваны ✨",
];

const STEP_SUBTITLES = [
  "Вход в состояние",
  "Сенсорика",
  "Энергия Масла",
  "Свободный полёт",
  "Послание Даваны",
];

const TOTAL_INTERACTIVE_STEPS = 4; // 0-3 are interactive, 4 is insight reveal

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

function ChipButton({
  selected,
  onClick,
  emoji,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm transition-all duration-300 ${
        selected
          ? "bg-primary text-primary-foreground shadow-[0_0_16px_hsl(var(--primary)/0.35)] -translate-y-0.5 scale-105"
          : "bg-white/40 text-foreground/70 hover:bg-white/60 hover:-translate-y-0.5 hover:shadow-sm backdrop-blur-sm border border-white/20"
      }`}
    >
      <span className="text-base">{emoji}</span>
      <span>{label}</span>
    </button>
  );
}

export function DiaryForm({ oilId, date, onSaved }: DiaryFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedSensation, setSelectedSensation] = useState<string | null>(null);
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
    setStep((s) => Math.min(s + 1, TOTAL_INTERACTIVE_STEPS - 1));
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  };

  const finishSession = () => {
    setSelectedMoods([]);
    setSelectedSensation(null);
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

      const { error } = await supabase.from("entries").insert({
        user_id: user.id,
        oil_id: oilId,
        mood: selectedMoods[0] || null,
        content: content.trim(),
        is_public: isPublic,
        energy_tags: selectedEnergy,
        sensation: selectedSensation,
        ...(date ? { date } : {}),
      });
      if (error) throw error;

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
        setStep(4);
      } else {
        finishSession();
      }
    },
    onError: () => {
      toast.error("Не удалось сохранить запись");
    },
  });

  const canSave = content.trim().length > 0;
  const totalDots = insightText !== null ? 5 : TOTAL_INTERACTIVE_STEPS;

  // Alchemy loading overlay
  if (isPending) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-12 flex flex-col items-center justify-center gap-6 relative overflow-hidden"
      >
        <SparkleBackground count={12} />
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
    <div className="space-y-6 relative">
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: totalDots }).map((_, i) => (
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
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Step 0: Moods */}
            {step === 0 && (
              <div className="glass-card p-6 rounded-[1.75rem]">
                <p className="mb-4 text-xs text-muted-foreground tracking-wide">
                  Выбери 1–2 состояния
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {MOODS.map((m) => (
                    <ChipButton
                      key={m.value}
                      selected={selectedMoods.includes(m.value)}
                      onClick={() => toggleMood(m.value)}
                      emoji={m.emoji}
                      label={m.label}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Step 1: Sensation */}
            {step === 1 && (
              <div className="glass-card p-6 rounded-[1.75rem]">
                <p className="mb-4 text-xs text-muted-foreground tracking-wide">
                  Отметь, где откликается сильнее всего
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {SENSATIONS.map((s) => (
                    <ChipButton
                      key={s.value}
                      selected={selectedSensation === s.value}
                      onClick={() =>
                        setSelectedSensation((prev) =>
                          prev === s.value ? null : s.value
                        )
                      }
                      emoji={s.emoji}
                      label={s.label}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Energy */}
            {step === 2 && (
              <div className="glass-card p-6 rounded-[1.75rem]">
                <p className="mb-4 text-xs text-muted-foreground tracking-wide">
                  Что откликается сегодня?
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {ENERGY_TAGS.map((e) => (
                    <ChipButton
                      key={e.value}
                      selected={selectedEnergy.includes(e.value)}
                      onClick={() => toggleEnergy(e.value)}
                      emoji={e.emoji}
                      label={e.label}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Free writing */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="glass-card p-5 rounded-[1.75rem]">
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Просто дыши и позволь словам литься. Начни с физических ощущений или образов... Что масло открывает тебе сегодня?"
                    className="min-h-[200px] resize-none rounded-2xl border-0 bg-transparent px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground/40 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>

                <div className="glass-card p-4 rounded-[1.75rem]">
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
            {step === 4 && insightText && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="space-y-5"
              >
                <div className="relative overflow-hidden rounded-[1.75rem] border border-white/30 bg-white/50 p-7 shadow-xl shadow-primary/5 backdrop-blur-2xl">
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
        {step > 0 && step < 4 && (
          <Button
            variant="ghost"
            onClick={goBack}
            className="rounded-full gap-2 py-5 text-sm text-muted-foreground transition-all duration-300 hover:-translate-y-0.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Button>
        )}

        {step < 3 ? (
          <Button
            onClick={goNext}
            className="flex-1 rounded-full gap-2 py-5 text-sm tracking-wide transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/20"
          >
            Далее
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : step === 3 ? (
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
