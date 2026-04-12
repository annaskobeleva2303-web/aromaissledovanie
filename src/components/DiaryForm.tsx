import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { BodyZoneChips } from "@/components/BodyZoneChips";
import { Loader2, Users, ArrowLeft, Sparkles, Heart, Zap, Smile, Check, Lock, Mic, MicOff } from "lucide-react";
import { InsightShareCard } from "@/components/InsightShareCard";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { SparkleBackground } from "@/components/SparkleBackground";

// --- Voice Input Button ---
function VoiceInputButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const isSupported = !!SpeechRecognition;

  const toggleListening = useCallback(() => {
    if (!isSupported) {
      setError("Голосовой ввод не поддерживается в этом браузере");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ru-RU";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        onTranscript(finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") {
        setError("Доступ к микрофону запрещён. Разреши его в настройках браузера");
      } else if (event.error !== "aborted") {
        setError("Ошибка распознавания. Попробуй ещё раз");
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
      setIsListening(true);
      setError(null);
    } catch {
      setError("Не удалось запустить распознавание речи");
    }
  }, [isListening, isSupported, onTranscript]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  if (!isSupported) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <motion.button
        type="button"
        onClick={toggleListening}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        className={`relative w-14 h-14 rounded-full backdrop-blur-2xl border flex items-center justify-center transition-all duration-300 ${
          isListening
            ? "bg-white/50 border-white/40"
            : "bg-white/30 border-white/20 hover:bg-white/40"
        }`}
        style={
          isListening
            ? {
                boxShadow:
                  "0 0 24px 8px hsl(20 95% 73% / 0.35), 0 0 48px 16px hsl(263 72% 52% / 0.15), inset 0 1px 0 hsl(0 0% 100% / 0.4)",
              }
            : {
                boxShadow:
                  "0 4px 20px hsl(263 72% 52% / 0.08), inset 0 1px 0 hsl(0 0% 100% / 0.3)",
              }
        }
      >
        {isListening && (
          <motion.div
            className="absolute inset-0 rounded-full"
            animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            style={{
              background: "radial-gradient(circle, hsl(20 95% 73% / 0.3), transparent 70%)",
            }}
          />
        )}
        {isListening ? (
          <MicOff className="h-6 w-6 text-destructive/80 relative z-10" strokeWidth={1.5} />
        ) : (
          <Mic className="h-6 w-6 text-primary/70 relative z-10" strokeWidth={1.5} />
        )}
      </motion.button>

      <AnimatePresence>
        {isListening && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-xs text-primary/70 tracking-wide font-light"
          >
            Слушаю... говорите
          </motion.p>
        )}
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-xs text-destructive/70 text-center max-w-[200px]"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

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

type SessionPhase = "hub" | "before" | "contact" | "breath" | "sensory" | "after" | "writing" | "insight";

interface DiaryFormProps {
  oilId: string;
  date?: string;
  onSaved?: () => void;
}

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

      <div className="relative pt-8 pb-1 px-1">
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

        <div className="relative h-8 flex items-center">
          <div className="w-full h-[3px] rounded-full bg-white/20 relative overflow-visible">
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
            {hasZero && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-[1.5px] h-3 rounded-full bg-foreground/15"
                style={{ left: `${zeroPct}%` }}
              />
            )}
          </div>

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

// --- Session Hub Card ---
function SessionCard({
  number,
  title,
  subtitle,
  emoji,
  completed,
  locked,
  onClick,
}: {
  number: number;
  title: string;
  subtitle: string;
  emoji: string;
  completed: boolean;
  locked: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={locked ? {} : { scale: 1.01 }}
      whileTap={locked ? {} : { scale: 0.98 }}
      onClick={locked ? undefined : onClick}
      disabled={locked}
      className={`relative w-full text-left rounded-[1.75rem] p-5 backdrop-blur-2xl border transition-all duration-300 ${
        locked
          ? "opacity-40 cursor-not-allowed border-white/10 bg-white/10"
          : completed
            ? "border-transparent bg-white/40 shadow-[0_0_20px_6px_rgba(255,180,80,0.20)]"
            : "border-white/20 bg-white/25 hover:bg-white/35 hover:shadow-lg hover:shadow-primary/10"
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <span className="text-2xl">{emoji}</span>
          {completed && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary/80 flex items-center justify-center shadow-md"
            >
              <Check className="h-3 w-3 text-white" strokeWidth={3} />
            </motion.div>
          )}
          {locked && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-foreground/20 flex items-center justify-center">
              <Lock className="h-3 w-3 text-foreground/40" strokeWidth={2} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.15em] text-primary/50 font-medium">
              Этап {number}
            </span>
          </div>
          <p className="font-medium text-foreground/90 text-sm mt-0.5">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>
    </motion.button>
  );
}

export function DiaryForm({ oilId, date, onSaved }: DiaryFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Session Hub state
  const [phase, setPhase] = useState<SessionPhase>("hub");
  const [beforeDone, setBeforeDone] = useState(false);
  const [contactDone, setContactDone] = useState(false);
  const [afterDone, setAfterDone] = useState(false);
  const [writingDone, setWritingDone] = useState(false);
  const [skipBefore, setSkipBefore] = useState(false);

  // Before state
  const [energyBefore, setEnergyBefore] = useState(5);
  const [moodScoreBefore, setMoodScoreBefore] = useState(0);
  const [moodsBefore, setMoodsBefore] = useState<string[]>([]);

  // Oil contact (sensory)
  const [oilBodyZones, setOilBodyZones] = useState<string[]>([]);
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
  const [shareQuote, setShareQuote] = useState<string | null>(null);

  // Breath timer
  const [breathTimer, setBreathTimer] = useState(10);
  const [breathDone, setBreathDone] = useState(false);
  const breathIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleMood = (list: string[], setter: (v: string[]) => void, value: string) => {
    setter(
      list.includes(value)
        ? list.filter((m) => m !== value)
        : list.length < 2
          ? [...list, value]
          : [list[1], value]
    );
  };

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

  // When entering contact phase, start with breath
  const enterContact = () => {
    startBreathTimer();
    setPhase("breath");
  };

  const finishBreath = () => {
    setPhase("sensory");
  };

  const completePhase = (p: SessionPhase) => {
    if (p === "before") setBeforeDone(true);
    if (p === "sensory") setContactDone(true);
    if (p === "after") setAfterDone(true);
    if (p === "writing") setWritingDone(true);
    setPhase("hub");
  };

  const recordType = beforeDone ? "full" : "quick";

  const canFinishSession = contactDone && writingDone;

  const finishSession = () => {
    queryClient.invalidateQueries({ queryKey: ["entries", oilId] });
    queryClient.invalidateQueries({ queryKey: ["public-entries", oilId] });
    queryClient.invalidateQueries({ queryKey: ["ai-insights-history", oilId] });
    queryClient.invalidateQueries({ queryKey: ["ai-insights-by-date", oilId] });
    queryClient.invalidateQueries({ queryKey: ["entries-count", oilId] });
    setPhase("hub");
    setBeforeDone(false);
    setContactDone(false);
    setAfterDone(false);
    setWritingDone(false);
    setSkipBefore(false);
    setEnergyBefore(5);
    setMoodScoreBefore(0);
    setMoodsBefore([]);
    setOilBodyZones([]);
    setOilSensation("");
    setOilVisualImage("");
    setEnergyAfter(5);
    setMoodScoreAfter(0);
    setMoodsAfter([]);
    setContent("");
    setIsPublic(false);
    setInsightText(null);
    setShareQuote(null);
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
        oil_body_location: oilBodyZones.length > 0 ? JSON.stringify(oilBodyZones) : null,
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
      let quote: string | null = null;
      try {
        const { data, error: fnError } = await supabase.functions.invoke("generate-insight", {
          body: { oilId },
        });
        if (!fnError && data?.insight) {
          insight = data.insight;
          quote = data.shareQuote || null;
        }
      } catch {
        // AI is optional
      }
      return { insight, quote };
    },
    onSuccess: (result) => {
      toast.success("Запись сохранена ✨");
      if (result?.insight) {
        setInsightText(result.insight);
        setShareQuote(result.quote);
        setPhase("insight");
      } else {
        finishSession();
      }
    },
    onError: () => {
      toast.error("Не удалось сохранить запись");
    },
  });

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
      <AnimatePresence mode="wait">
        {/* ===== SESSION HUB ===== */}
        {phase === "hub" && (
          <motion.div
            key="hub"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="space-y-4"
          >
            <div className="text-center mb-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary/60 font-medium">
                Сессия
              </p>
              <h3 className="mt-1 font-serif text-lg tracking-wide text-foreground/90">
                Твоё пространство исследования
              </h3>
            </div>

            <div className="flex flex-col gap-3">
              <SessionCard
                number={1}
                title="Точка входа"
                subtitle="Замерь энергию и настроение до масла"
                emoji="📊"
                completed={beforeDone}
                locked={false}
                onClick={() => setPhase("before")}
              />
              <SessionCard
                number={2}
                title="Контакт с Даваной"
                subtitle="Дыхание, сенсорика и образы"
                emoji="🌿"
                completed={contactDone}
                locked={false}
                onClick={enterContact}
              />
              <SessionCard
                number={3}
                title="Интеграция"
                subtitle="Замер После и свободный дневник"
                emoji="✨"
                completed={afterDone && writingDone}
                locked={!contactDone}
                onClick={() => {
                  if (beforeDone && !afterDone) {
                    setPhase("after");
                  } else {
                    setPhase("writing");
                  }
                }}
              />
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Button
                onClick={() => saveEntry()}
                disabled={!canFinishSession || !content.trim()}
                className="w-full rounded-full gap-2 py-5 text-sm tracking-wide transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/20 mt-2"
              >
                <Sparkles className="h-4 w-4" />
                Завершить сессию и получить Инсайт
              </Button>
              {!canFinishSession && (
                <p className="text-center text-[10px] text-muted-foreground/60 mt-2 tracking-wide">
                  Пройди Контакт с Даваной и напиши в дневник
                </p>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* ===== PHASE: BEFORE ===== */}
        {phase === "before" && (
          <PhaseWrapper
            key="before"
            title="Твоё состояние сейчас"
            subtitle="Замер ДО"
            onBack={() => setPhase("hub")}
            onComplete={() => completePhase("before")}
            completeLabel="Завершить этап"
          >
            <div className="glass-card p-6 rounded-[1.75rem] space-y-6">
              <GlassSlider label="Энергия" icon={Zap} value={energyBefore} onChange={setEnergyBefore} min={0} max={10} minLabel="Обесточена" maxLabel="Вибрирую на максимум" />
              <GlassSlider label="Настроение" icon={Smile} value={moodScoreBefore} onChange={setMoodScoreBefore} min={-5} max={5} minLabel="Подавленность" maxLabel="Эйфория" />
              <div>
                <p className="mb-3 text-xs text-muted-foreground tracking-wide">Выбери 1–2 состояния</p>
                <div className="flex flex-wrap gap-2.5">
                  {MOODS.map((m) => (
                    <ChipButton key={m.value} selected={moodsBefore.includes(m.value)} onClick={() => toggleMood(moodsBefore, setMoodsBefore, m.value)} emoji={m.emoji} label={m.label} />
                  ))}
                </div>
              </div>
            </div>
          </PhaseWrapper>
        )}

        {/* ===== PHASE: BREATH ===== */}
        {phase === "breath" && (
          <PhaseWrapper
            key="breath"
            title="Сделай глубокий вдох..."
            subtitle="Контакт с Маслом"
            onBack={() => setPhase("hub")}
            onComplete={finishBreath}
            completeLabel="Далее"
            disableComplete={!breathDone}
          >
            <div className="flex flex-col items-center justify-center py-6 gap-6">
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
                      <motion.span key="timer" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="font-serif text-5xl font-light text-primary/70">
                        {breathTimer}
                      </motion.span>
                    ) : (
                      <motion.div key="done" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}>
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
          </PhaseWrapper>
        )}

        {/* ===== PHASE: SENSORY ===== */}
        {phase === "sensory" && (
          <PhaseWrapper
            key="sensory"
            title="Контакт с Даваной"
            subtitle="Сенсорика и образы"
            onBack={() => setPhase("hub")}
            onComplete={() => completePhase("sensory")}
            completeLabel="Завершить этап"
          >
            <div className="glass-card p-6 rounded-[1.75rem] space-y-5">
              <BodyZoneChips selected={oilBodyZones} onChange={setOilBodyZones} />
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">✋ Как оно ощущается?</label>
                <Input value={oilSensation} onChange={(e) => setOilSensation(e.target.value)} placeholder="Тепло, покалывание, давление..." className="rounded-2xl border-white/20 bg-white/30 backdrop-blur-sm focus-visible:ring-primary/30" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">🎨 Какой образ или картинка всплывает?</label>
                <Input value={oilVisualImage} onChange={(e) => setOilVisualImage(e.target.value)} placeholder="Лес, океан, что-то абстрактное..." className="rounded-2xl border-white/20 bg-white/30 backdrop-blur-sm focus-visible:ring-primary/30" />
              </div>
            </div>
          </PhaseWrapper>
        )}

        {/* ===== PHASE: AFTER ===== */}
        {phase === "after" && (
          <PhaseWrapper
            key="after"
            title="Сверь своё состояние"
            subtitle="Замер ПОСЛЕ"
            onBack={() => setPhase("hub")}
            onComplete={() => {
              completePhase("after");
              if (!writingDone) {
                setPhase("writing");
              }
            }}
            completeLabel={writingDone ? "Завершить этап" : "Далее — Дневник"}
          >
            <div className="glass-card p-6 rounded-[1.75rem] space-y-6">
              <GlassSlider label="Энергия" icon={Zap} value={energyAfter} onChange={setEnergyAfter} min={0} max={10} minLabel="Обесточена" maxLabel="Вибрирую на максимум" />
              <GlassSlider label="Настроение" icon={Smile} value={moodScoreAfter} onChange={setMoodScoreAfter} min={-5} max={5} minLabel="Подавленность" maxLabel="Эйфория" />
              <div>
                <p className="mb-3 text-xs text-muted-foreground tracking-wide">Выбери 1–2 состояния</p>
                <div className="flex flex-wrap gap-2.5">
                  {MOODS.map((m) => (
                    <ChipButton key={m.value} selected={moodsAfter.includes(m.value)} onClick={() => toggleMood(moodsAfter, setMoodsAfter, m.value)} emoji={m.emoji} label={m.label} />
                  ))}
                </div>
              </div>
            </div>
          </PhaseWrapper>
        )}

        {/* ===== PHASE: WRITING ===== */}
        {phase === "writing" && (
          <PhaseWrapper
            key="writing"
            title="Свободный поток"
            subtitle="Свободный полёт"
            onBack={() => setPhase("hub")}
            onComplete={() => completePhase("writing")}
            completeLabel="Завершить этап"
            disableComplete={!content.trim()}
          >
            <div className="space-y-5">
              <div className="glass-card p-5 rounded-[1.75rem] space-y-4">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Просто дыши и позволь словам литься. Что масло открывает тебе сегодня?"
                  className="min-h-[200px] resize-none rounded-2xl border-0 bg-transparent px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground/40 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <div className="flex justify-center pt-1">
                  <VoiceInputButton
                    onTranscript={(text) =>
                      setContent((prev) => (prev ? prev + " " + text : text))
                    }
                  />
                </div>
              </div>
              <div className="glass-card p-4 rounded-[1.75rem]">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-primary/60" strokeWidth={1.5} />
                    <Label htmlFor="is-public" className="text-sm font-medium tracking-wide text-foreground/80 cursor-pointer">
                      Поделиться анонимно
                    </Label>
                  </div>
                  <Switch id="is-public" checked={isPublic} onCheckedChange={setIsPublic} />
                </div>
              </div>
            </div>
          </PhaseWrapper>
        )}

        {/* ===== PHASE: INSIGHT ===== */}
        {phase === "insight" && insightText && (
          <motion.div
            key="insight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="space-y-5"
          >
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary/60 font-medium">Послание Даваны</p>
              <h3 className="mt-1 font-serif text-lg tracking-wide text-foreground/90">Твой инсайт от Даваны ✨</h3>
            </div>

            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/30 bg-white/50 p-7 shadow-xl shadow-primary/5 backdrop-blur-2xl">
              <div className="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-accent/15 blur-3xl" />
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.8 }} className="relative">
                <Sparkles className="mx-auto mb-4 h-6 w-6 text-primary/60" />
                <div className="max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/85 font-light">{insightText}</p>
                </div>
              </motion.div>
            </div>

            <InsightShareCard
              insightText={insightText}
              shareQuote={shareQuote}
              moodBefore={moodsBefore[0] || null}
              moodAfter={moodsAfter[0] || null}
              energyBefore={beforeDone ? energyBefore : null}
              energyAfter={afterDone ? energyAfter : null}
              moodScoreBefore={beforeDone ? moodScoreBefore : null}
              moodScoreAfter={afterDone ? moodScoreAfter : null}
            />

            <Button
              onClick={finishSession}
              className="w-full rounded-full gap-2 py-5 text-sm tracking-wide transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/20"
            >
              <Heart className="h-4 w-4" />
              Благодарю
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Reusable phase wrapper with header + nav ---
function PhaseWrapper({
  title,
  subtitle,
  onBack,
  onComplete,
  completeLabel,
  disableComplete,
  children,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  onComplete: () => void;
  completeLabel: string;
  disableComplete?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="space-y-5"
    >
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-primary/60 font-medium">{subtitle}</p>
        <h3 className="mt-1 font-serif text-lg tracking-wide text-foreground/90">{title}</h3>
      </div>

      {children}

      <div className="flex gap-3">
        <Button
          variant="ghost"
          onClick={onBack}
          className="rounded-full gap-2 py-5 text-sm text-muted-foreground transition-all duration-300 hover:-translate-y-0.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад
        </Button>
        <Button
          onClick={onComplete}
          disabled={disableComplete}
          className="flex-1 rounded-full gap-2 py-5 text-sm tracking-wide transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/20"
        >
          {completeLabel}
        </Button>
      </div>
    </motion.div>
  );
}
