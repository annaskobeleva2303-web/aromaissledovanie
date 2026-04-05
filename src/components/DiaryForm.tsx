import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Loader2, Users, ArrowRight, ArrowLeft, Sparkles, Heart, Zap, Smile, Check } from "lucide-react";
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

type RecordType = "full" | "quick";

// Steps: 0=choose path, 1=before, 6=breath, 2=oil contact, 3=after, 4=free writing, 5=insight
const STEP_TITLES: Record<number, string> = {
  0: "Начнём исследование?",
  1: "Твоё состояние сейчас",
  6: "Сделай глубокий вдох...",
  2: "Контакт с Даваной",
  3: "Сверь своё состояние",
  4: "Свободный поток",
  5: "Твой инсайт от Даваны ✨",
};

const STEP_SUBTITLES: Record<number, string> = {
  0: "Выбери путь",
  1: "Замер ДО",
  6: "Контакт с Маслом",
  2: "Сенсорика и образы",
  3: "Замер ПОСЛЕ",
  4: "Свободный полёт",
  5: "Послание Даваны",
};

interface DiaryFormProps {
  oilId: string;
  date?: string;
  onSaved?: () => void;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
    scale: 0.98,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -40 : 40,
    opacity: 0,
    scale: 0.98,
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
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm backdrop-blur-sm transition-all duration-300 ${
        selected
          ? "bg-[rgba(255,210,120,0.13)] text-foreground border-transparent shadow-[0_0_20px_6px_rgba(255,180,80,0.30),0_0_40px_10px_rgba(255,160,60,0.12)]"
          : "bg-white/40 text-foreground/70 border border-white/20 hover:bg-white/60 hover:shadow-sm"
      }`}
    >
      <span className="text-base">{emoji}</span>
      <span>{label}</span>
    </motion.button>
  );
}

function GlassSlider({
  label,
  icon: Icon,
  value,
  onChange,
  min,
  max,
  minLabel,
  maxLabel,
}: {
  label: string;
  icon: typeof Zap;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
}) {
  const prevValue = useRef(value);
  const range = max - min;
  const pct = ((value - min) / range) * 100;
  const hasZero = min < 0 && max > 0;
  const zeroPct = ((0 - min) / range) * 100;

  return (
    <div className="space-y-4 select-none">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary/60" strokeWidth={1.5} />
        <span className="text-sm font-medium text-foreground/80">{label}</span>
      </div>

      {/* Slider container */}
      <div className="relative pt-8 pb-1 px-1">
        {/* Floating value bubble */}
        <motion.div
          className="absolute -top-0 pointer-events-none"
          style={{ left: `${pct}%` }}
          animate={{ left: `${pct}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
        >
          <div className="relative -translate-x-1/2">
            <span className="text-lg font-serif font-semibold text-primary drop-shadow-sm">
              {value > 0 && min < 0 ? `+${value}` : value}
            </span>
          </div>
        </motion.div>

        {/* Track background */}
        <div className="relative h-8 flex items-center">
          <div className="w-full h-[3px] rounded-full bg-white/20 relative overflow-visible">
            {/* Filled range with glow gradient */}
            <motion.div
              className="absolute top-0 left-0 h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: "linear-gradient(90deg, hsl(263 72% 62% / 0.7), hsl(35 90% 60% / 0.8))",
                boxShadow: "0 0 12px 2px hsl(263 72% 52% / 0.25), 0 0 20px 4px hsl(35 90% 60% / 0.15)",
              }}
              animate={{ width: `${pct}%` }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            />

            {/* Zero center mark for mood slider */}
            {hasZero && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-[1.5px] h-3 rounded-full bg-foreground/15"
                style={{ left: `${zeroPct}%` }}
              />
            )}
          </div>

          {/* Custom pearl thumb */}
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
            style={{ left: `${pct}%` }}
            animate={{ left: `${pct}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            <div
              className="w-5 h-5 rounded-full bg-white border border-white/60"
              style={{
                boxShadow: `0 0 14px 4px hsl(263 72% 62% / 0.35), 0 0 6px 1px hsl(35 90% 65% / 0.3), 0 2px 8px rgba(0,0,0,0.08)`,
              }}
            />
          </motion.div>

          {/* Invisible native slider for interaction */}
          <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={value}
            onChange={(e) => {
              const newVal = Number(e.target.value);
              if (newVal !== prevValue.current) {
                prevValue.current = newVal;
                if (navigator.vibrate) {
                  navigator.vibrate(8);
                }
              }
              onChange(newVal);
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
        </div>
      </div>

      <div className="flex justify-between text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70 font-medium">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

export function DiaryForm({ oilId, date, onSaved }: DiaryFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [recordType, setRecordType] = useState<RecordType>("full");

  // Before state
  const [energyBefore, setEnergyBefore] = useState(5);
  const [moodScoreBefore, setMoodScoreBefore] = useState(0);
  const [moodsBefore, setMoodsBefore] = useState<string[]>([]);

  // Oil contact
  const [oilBodyLocation, setOilBodyLocation] = useState("");
  const [oilSensation, setOilSensation] = useState("");
  const [oilVisualImage, setOilVisualImage] = useState("");

  // After state
  const [energyAfter, setEnergyAfter] = useState(5);
  const [moodScoreAfter, setMoodScoreAfter] = useState(0);
  const [moodsAfter, setMoodsAfter] = useState<string[]>([]);

  // Free writing
  const [content, setContent] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [insightText, setInsightText] = useState<string | null>(null);

  const toggleMood = (list: string[], setter: (v: string[]) => void, value: string) => {
    setter(
      list.includes(value)
        ? list.filter((m) => m !== value)
        : list.length < 2
          ? [...list, value]
          : [list[1], value]
    );
  };

  // Navigation for full vs quick paths
  const getStepSequence = (): number[] => {
    if (recordType === "full") return [0, 1, 6, 2, 3, 4];
    return [0, 2, 4]; // quick: skip before/after/breath
  };

  const [breathTimer, setBreathTimer] = useState(10);
  const [breathDone, setBreathDone] = useState(false);
  const breathIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startBreathTimer = useCallback(() => {
    setBreathTimer(10);
    setBreathDone(false);
    if (breathIntervalRef.current) clearInterval(breathIntervalRef.current);
    breathIntervalRef.current = setInterval(() => {
      setBreathTimer((prev) => {
        if (prev <= 1) {
          clearInterval(breathIntervalRef.current!);
          breathIntervalRef.current = null;
          setBreathDone(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (breathIntervalRef.current) clearInterval(breathIntervalRef.current);
    };
  }, []);

  const sequence = getStepSequence();
  const currentSeqIndex = sequence.indexOf(step);

  const goNext = () => {
    setDirection(1);
    if (currentSeqIndex < sequence.length - 1) {
      const nextStep = sequence[currentSeqIndex + 1];
      if (nextStep === 6) startBreathTimer();
      setStep(nextStep);
    }
  };

  const goBack = () => {
    setDirection(-1);
    if (currentSeqIndex > 0) {
      setStep(sequence[currentSeqIndex - 1]);
    }
  };

  const choosePath = (type: RecordType) => {
    setRecordType(type);
    setDirection(1);
    if (type === "full") {
      setStep(1);
    } else {
      setStep(2);
    }
  };

  const finishSession = () => {
    setStep(0);
    setRecordType("full");
    setEnergyBefore(5);
    setMoodScoreBefore(0);
    setMoodsBefore([]);
    setOilBodyLocation("");
    setOilSensation("");
    setOilVisualImage("");
    setEnergyAfter(5);
    setMoodScoreAfter(0);
    setMoodsAfter([]);
    setContent("");
    setIsPublic(false);
    setInsightText(null);
    queryClient.invalidateQueries({ queryKey: ["entries", oilId] });
    queryClient.invalidateQueries({ queryKey: ["public-entries", oilId] });
    queryClient.invalidateQueries({ queryKey: ["ai-insights-history", oilId] });
    queryClient.invalidateQueries({ queryKey: ["entries-count", oilId] });
    onSaved?.();
  };

  const { mutate: saveEntry, isPending } = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const entryData: Record<string, unknown> = {
        user_id: user.id,
        oil_id: oilId,
        mood: moodsAfter[0] || moodsBefore[0] || null,
        content: content.trim(),
        is_public: isPublic,
        energy_tags: [],
        sensation: null,
        record_type: recordType,
        oil_body_location: oilBodyLocation.trim() || null,
        oil_sensation: oilSensation.trim() || null,
        oil_visual_image: oilVisualImage.trim() || null,
        ...(date ? { date } : {}),
      };

      if (recordType === "full") {
        entryData.energy_before = energyBefore;
        entryData.mood_score_before = moodScoreBefore;
        entryData.energy_after = energyAfter;
        entryData.mood_score_after = moodScoreAfter;
      }

      const { error } = await supabase.from("entries").insert(entryData as any);
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
        setStep(5);
      } else {
        finishSession();
      }
    },
    onError: () => {
      toast.error("Не удалось сохранить запись");
    },
  });

  const canSave = content.trim().length > 0;
  const isLastInteractive = step === 4;
  const isInsightStep = step === 5;
  const isBreathStep = step === 6;

  // Progress dots
  const totalDots = insightText !== null ? sequence.length + 1 : sequence.length;
  const dotIndex = isInsightStep ? sequence.length : currentSeqIndex;

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
      {step !== 0 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalDots }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  i === dotIndex
                    ? "w-8 bg-primary shadow-md shadow-primary/30"
                    : i < dotIndex
                      ? "w-2 bg-primary/50"
                      : "w-2 bg-foreground/10"
                }`}
              />
            </div>
          ))}
        </div>
      )}

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
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Step 0: Choose path */}
            {step === 0 && (
              <div className="flex flex-col gap-4">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => choosePath("full")}
                  className="glass-card p-6 rounded-[1.75rem] text-left space-y-2 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📊</span>
                    <span className="font-medium text-foreground/90">Зафиксировать состояние До</span>
                  </div>
                  <p className="text-xs text-muted-foreground pl-11">
                    Замерь энергию и настроение до и после масла — увидишь трансформацию
                  </p>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => choosePath("quick")}
                  className="glass-card p-6 rounded-[1.75rem] text-left space-y-2 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">✨</span>
                    <span className="font-medium text-foreground/90">Сразу к маслу</span>
                  </div>
                  <p className="text-xs text-muted-foreground pl-11">
                    Погрузись в сенсорику и образы без замеров
                  </p>
                </motion.button>
              </div>
            )}

            {/* Step 1: Before state */}
            {step === 1 && (
              <div className="glass-card p-6 rounded-[1.75rem] space-y-6">
                <GlassSlider
                  label="Энергия"
                  icon={Zap}
                  value={energyBefore}
                  onChange={setEnergyBefore}
                  min={0}
                  max={10}
                  minLabel="Обесточена"
                  maxLabel="Вибрирую на максимум"
                />
                <GlassSlider
                  label="Настроение"
                  icon={Smile}
                  value={moodScoreBefore}
                  onChange={setMoodScoreBefore}
                  min={-5}
                  max={5}
                  minLabel="Подавленность"
                  maxLabel="Эйфория"
                />
                <div>
                  <p className="mb-3 text-xs text-muted-foreground tracking-wide">
                    Выбери 1–2 состояния
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {MOODS.map((m) => (
                      <ChipButton
                        key={m.value}
                        selected={moodsBefore.includes(m.value)}
                        onClick={() => toggleMood(moodsBefore, setMoodsBefore, m.value)}
                        emoji={m.emoji}
                        label={m.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 6: Breath pause */}
            {step === 6 && (
              <div className="flex flex-col items-center justify-center py-6 gap-6">
                {/* Pulsing circle with timer */}
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="relative flex items-center justify-center"
                >
                  <div
                    className="w-40 h-40 rounded-full bg-white/30 backdrop-blur-2xl border border-white/25 flex items-center justify-center"
                    style={{
                      boxShadow: "0 0 60px 15px hsl(263 72% 52% / 0.12), 0 0 30px 8px hsl(20 95% 73% / 0.1), inset 0 1px 0 hsl(0 0% 100% / 0.4)",
                    }}
                  >
                    <AnimatePresence mode="wait">
                      {!breathDone ? (
                        <motion.span
                          key="timer"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="font-serif text-5xl font-light text-primary/70"
                        >
                          {breathTimer}
                        </motion.span>
                      ) : (
                        <motion.div
                          key="done"
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        >
                          <Check className="h-12 w-12 text-primary/60" strokeWidth={1.5} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>

                <p className="text-sm text-muted-foreground/70 tracking-wide font-light">
                  Подыши, это время для тебя.
                </p>
              </div>
            )}

            {/* Step 2: Oil contact */}
            {step === 2 && (
              <div className="glass-card p-6 rounded-[1.75rem] space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/80">
                    🫶 Где в теле ощущается масло?
                  </label>
                  <Input
                    value={oilBodyLocation}
                    onChange={(e) => setOilBodyLocation(e.target.value)}
                    placeholder="Грудь, горло, живот..."
                    className="rounded-2xl border-white/20 bg-white/30 backdrop-blur-sm focus-visible:ring-primary/30"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/80">
                    ✋ Как оно ощущается?
                  </label>
                  <Input
                    value={oilSensation}
                    onChange={(e) => setOilSensation(e.target.value)}
                    placeholder="Тепло, покалывание, давление..."
                    className="rounded-2xl border-white/20 bg-white/30 backdrop-blur-sm focus-visible:ring-primary/30"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/80">
                    🎨 Какой образ или картинка всплывает?
                  </label>
                  <Input
                    value={oilVisualImage}
                    onChange={(e) => setOilVisualImage(e.target.value)}
                    placeholder="Лес, океан, что-то абстрактное..."
                    className="rounded-2xl border-white/20 bg-white/30 backdrop-blur-sm focus-visible:ring-primary/30"
                  />
                </div>
              </div>
            )}

            {/* Step 3: After state */}
            {step === 3 && (
              <div className="glass-card p-6 rounded-[1.75rem] space-y-6">
                <GlassSlider
                  label="Энергия"
                  icon={Zap}
                  value={energyAfter}
                  onChange={setEnergyAfter}
                  min={0}
                  max={10}
                  minLabel="Обесточена"
                  maxLabel="Вибрирую на максимум"
                />
                <GlassSlider
                  label="Настроение"
                  icon={Smile}
                  value={moodScoreAfter}
                  onChange={setMoodScoreAfter}
                  min={-5}
                  max={5}
                  minLabel="Подавленность"
                  maxLabel="Эйфория"
                />
                <div>
                  <p className="mb-3 text-xs text-muted-foreground tracking-wide">
                    Выбери 1–2 состояния
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {MOODS.map((m) => (
                      <ChipButton
                        key={m.value}
                        selected={moodsAfter.includes(m.value)}
                        onClick={() => toggleMood(moodsAfter, setMoodsAfter, m.value)}
                        emoji={m.emoji}
                        label={m.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Free writing */}
            {step === 4 && (
              <div className="space-y-5">
                <div className="glass-card p-5 rounded-[1.75rem]">
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Просто дыши и позволь словам литься. Что масло открывает тебе сегодня?"
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

            {/* Step 5: Insight reveal */}
            {step === 5 && insightText && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="space-y-5"
              >
                <div className="relative overflow-hidden rounded-[1.75rem] border border-white/30 bg-white/50 p-7 shadow-xl shadow-primary/5 backdrop-blur-2xl">
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
      {step !== 0 && (
        <div className="flex gap-3">
          {!isInsightStep && currentSeqIndex > 0 && (
            <Button
              variant="ghost"
              onClick={goBack}
              className="rounded-full gap-2 py-5 text-sm text-muted-foreground transition-all duration-300 hover:-translate-y-0.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Назад
            </Button>
          )}

          {!isLastInteractive && !isInsightStep ? (
            <AnimatePresence mode="wait">
              {isBreathStep && !breathDone ? (
                <motion.div
                  key="breath-waiting"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  className="flex-1"
                >
                  <Button
                    disabled
                    className="w-full rounded-full gap-2 py-5 text-sm tracking-wide opacity-40"
                  >
                    Далее
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="next-ready"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="flex-1"
                >
                  <Button
                    onClick={goNext}
                    className="w-full rounded-full gap-2 py-5 text-sm tracking-wide transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/20"
                  >
                    Далее
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          ) : isLastInteractive ? (
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
      )}
    </div>
  );
}
