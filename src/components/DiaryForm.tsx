import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Save, Loader2, Users, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
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
];

const STEP_SUBTITLES = [
  "Вход в состояние",
  "Энергия Масла",
  "Свободный полёт",
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

export function DiaryForm({ oilId, date }: DiaryFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedEnergy, setSelectedEnergy] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [showAlchemy, setShowAlchemy] = useState(false);

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

  const { mutate: saveEntry, isPending } = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      setShowAlchemy(true);

      // Small delay for the alchemy animation
      await new Promise((r) => setTimeout(r, 1500));

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
    },
    onSuccess: () => {
      toast.success("Запись сохранена ✨");
      setSelectedMoods([]);
      setSelectedEnergy([]);
      setContent("");
      setIsPublic(false);
      setStep(0);
      setShowAlchemy(false);
      queryClient.invalidateQueries({ queryKey: ["entries", oilId] });
      queryClient.invalidateQueries({ queryKey: ["public-entries", oilId] });
    },
    onError: () => {
      setShowAlchemy(false);
      toast.error("Не удалось сохранить запись");
    },
  });

  const canSave = content.trim().length > 0;

  // Alchemy loading overlay
  if (showAlchemy) {
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
        {[0, 1, 2].map((i) => (
          <button
            key={i}
            onClick={() => {
              setDirection(i > step ? 1 : -1);
              setStep(i);
            }}
            className="flex items-center gap-2"
          >
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                i === step
                  ? "w-8 bg-primary shadow-md shadow-primary/30"
                  : i < step
                    ? "w-2 bg-primary/50"
                    : "w-2 bg-foreground/10"
              }`}
            />
          </button>
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
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 0 && (
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
        ) : (
          <Button
            onClick={() => saveEntry()}
            disabled={!canSave || isPending}
            className="flex-1 rounded-full gap-2 py-5 text-sm tracking-wide transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/20"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Сохранить запись
          </Button>
        )}
      </div>
    </div>
  );
}
