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
import { Loader2, Users, ArrowLeft, Sparkles, Heart, Zap, Smile, Check, Lock, Mic, MicOff, Compass, Flower2, Sprout, ChevronDown, RotateCw } from "lucide-react";
import { InsightShareCard } from "@/components/InsightShareCard";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { SparkleBackground } from "@/components/SparkleBackground";
import { EMOTIONAL_STATE_MAP, getEmojiForStateName } from "@/utils/stateUtils";
import fixWebmDuration from "webm-duration-fix";

const EMOTIONAL_STATES: { category: string; label: string; states: string[] }[] = [
  {
    category: "Дефицит",
    label: "Дефицит / Низкая энергия",
    states: EMOTIONAL_STATE_MAP.filter((s) => s.category === "Дефицит").map((s) => s.name),
  },
  {
    category: "Баланс",
    label: "Баланс / Нейтральный спектр",
    states: EMOTIONAL_STATE_MAP.filter((s) => s.category === "Баланс").map((s) => s.name),
  },
  {
    category: "Ресурс",
    label: "Ресурс / Высокая энергия",
    states: EMOTIONAL_STATE_MAP.filter((s) => s.category === "Ресурс").map((s) => s.name),
  },
];

function EmotionalStateChips({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  // First category open by default; rest collapsed for compact UI.
  const [openCategory, setOpenCategory] = useState<string | null>(
    EMOTIONAL_STATES[0]?.category ?? null,
  );

  const toggle = (state: string) => {
    if (navigator.vibrate) navigator.vibrate(8);
    if (selected.includes(state)) {
      onChange(selected.filter((s) => s !== state));
    } else if (selected.length < 3) {
      onChange([...selected, state]);
    } else {
      // replace oldest
      onChange([...selected.slice(1), state]);
    }
  };

  const toggleCategory = (category: string) => {
    setOpenCategory((current) => (current === category ? null : category));
  };

  return (
    <div className="space-y-1">
      {EMOTIONAL_STATES.map((group) => {
        const isOpen = openCategory === group.category;
        const selectedInGroup = group.states.filter((s) => selected.includes(s)).length;
        return (
          <div key={group.category} className="border-b border-white/10 last:border-b-0">
            <button
              type="button"
              onClick={() => toggleCategory(group.category)}
              className="w-full py-4 flex justify-between items-center text-left focus:outline-none group"
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-[0.18em] text-foreground/65 group-hover:text-foreground/85 transition-colors">
                  {group.label}
                </span>
                {selectedInGroup > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-primary/25 text-primary text-[10px] font-medium">
                    {selectedInGroup}
                  </span>
                )}
              </div>
              <motion.span
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="text-foreground/50 group-hover:text-foreground/80"
              >
                <ChevronDown className="h-4 w-4" strokeWidth={1.5} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap gap-2 pb-4 pt-1">
                    {group.states.map((state) => {
                      const isSelected = selected.includes(state);
                      return (
                        <motion.button
                          key={state}
                          type="button"
                          onClick={() => toggle(state)}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.96 }}
                          transition={{ type: "spring", stiffness: 400, damping: 25 }}
                          className={`rounded-full px-4 py-2 text-sm backdrop-blur-md transition-all duration-300 focus:outline-none inline-flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-primary/20 text-primary border border-primary/60 shadow-[0_0_12px_rgba(168,139,250,0.35)]"
                              : "bg-white/5 text-foreground/75 border border-white/10 hover:bg-white/10"
                          }`}
                          style={{ WebkitTapHighlightColor: "transparent" }}
                        >
                          <span className="opacity-90 text-base leading-none">{getEmojiForStateName(state)}</span>
                          <span>{state}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
      <p className="text-[10px] text-muted-foreground/60 tracking-wide pt-2">
        Можно выбрать до 3 состояний
      </p>
    </div>
  );
}

// --- Markdown accent parser for AI insights ---
const formatInsightText = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(_[^_]+_|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <span key={i} className="font-serif italic text-primary text-[1.1em]">{part.slice(2, -2)}</span>;
    }
    if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
      return <span key={i} className="font-serif italic text-primary text-[1.1em]">{part.slice(1, -1)}</span>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <span key={i} className="font-serif italic text-primary text-[1.1em]">{part.slice(1, -1)}</span>;
    }
    return part;
  });
};

// --- Animated Waveform (live mic level) ---
function LiveWaveform({ analyser }: { analyser: AnalyserNode | null }) {
  const [levels, setLevels] = useState<number[]>(() => Array(24).fill(0.15));
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!analyser) return;
    const buffer = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(buffer);
      const bins = 24;
      const step = Math.floor(buffer.length / bins);
      const next: number[] = [];
      for (let i = 0; i < bins; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += buffer[i * step + j];
        const avg = sum / step / 255;
        next.push(Math.max(0.12, Math.min(1, avg * 1.6)));
      }
      setLevels(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyser]);

  return (
    <div className="flex items-center justify-center gap-[3px] h-8 w-full max-w-[220px]">
      {levels.map((lv, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-gradient-to-t from-primary/40 via-primary/80 to-accent"
          animate={{ height: `${Math.round(lv * 100)}%` }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          style={{ minHeight: 4 }}
        />
      ))}
    </div>
  );
}

// --- Voice Input Button (Whisper via Edge Function) ---
function VoiceInputButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    setAnalyser(null);
  }, []);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Запись не поддерживается в этом браузере");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Audio analysis for waveform
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      source.connect(an);
      setAnalyser(an);

      // Pick a supported mime type
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      let mimeType = "";
      for (const c of candidates) {
        if ((window as any).MediaRecorder?.isTypeSupported?.(c)) {
          mimeType = c;
          break;
        }
      }
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        cleanupStream();
        if (blob.size === 0) {
          setError("Аудио не записано");
          return;
        }
        setIsTranscribing(true);
        try {
          const ext = (mr.mimeType || "audio/webm").includes("mp4") ? "mp4"
            : (mr.mimeType || "").includes("ogg") ? "ogg" : "webm";
          const file = new File([blob], `recording.${ext}`, { type: blob.type });
          const form = new FormData();
          form.append("file", file);
          form.append("language", "ru");

          const { data, error: fnError } = await supabase.functions.invoke("transcribe-audio", {
            body: form,
          });
          if (fnError) throw fnError;
          const text = (data as { text?: string })?.text?.trim();
          if (text) {
            onTranscript(text);
          } else {
            setError("Не удалось распознать речь");
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Ошибка транскрибации";
          setError(msg);
        } finally {
          setIsTranscribing(false);
        }
      };

      mr.start();
      setIsRecording(true);
    } catch (err: unknown) {
      cleanupStream();
      const name = (err as { name?: string })?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError("Доступ к микрофону запрещён. Разреши его в настройках браузера");
      } else {
        setError("Не удалось начать запись");
      }
    }
  }, [cleanupStream, onTranscript]);

  const toggle = useCallback(() => {
    if (isTranscribing) return;
    if (isRecording) stopRecording();
    else startRecording();
  }, [isRecording, isTranscribing, startRecording, stopRecording]);

  useEffect(() => {
    return () => {
      try {
        mediaRecorderRef.current?.state !== "inactive" && mediaRecorderRef.current?.stop();
      } catch {}
      cleanupStream();
    };
  }, [cleanupStream]);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <motion.button
        type="button"
        onClick={toggle}
        disabled={isTranscribing}
        whileHover={{ scale: isTranscribing ? 1 : 1.05 }}
        whileTap={{ scale: isTranscribing ? 1 : 0.92 }}
        className={`relative w-16 h-16 rounded-full backdrop-blur-2xl flex items-center justify-center transition-all duration-300 ${
          isRecording ? "bg-white/55" : "bg-white/30 hover:bg-white/45"
        } ${isTranscribing ? "opacity-70 cursor-wait" : ""}`}
        style={
          isRecording
            ? {
                boxShadow:
                  "0 0 0 6px hsl(0 84% 65% / 0.18), 0 0 28px 10px hsl(0 84% 65% / 0.40), 0 0 60px 18px hsl(263 72% 52% / 0.18), inset 0 1px 0 hsl(0 0% 100% / 0.5)",
              }
            : {
                boxShadow:
                  "0 4px 20px hsl(263 72% 52% / 0.10), inset 0 1px 0 hsl(0 0% 100% / 0.3)",
              }
        }
      >
        {/* Pulsing ring */}
        {isRecording && (
          <>
            <motion.span
              className="absolute inset-0 rounded-full"
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
              style={{ background: "radial-gradient(circle, hsl(0 84% 65% / 0.35), transparent 70%)" }}
            />
            <motion.span
              className="absolute inset-0 rounded-full border border-red-400/40"
              animate={{ scale: [1, 1.8], opacity: [0.7, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
            />
          </>
        )}

        {isTranscribing ? (
          <Loader2 className="h-6 w-6 text-primary relative z-10 animate-spin" strokeWidth={1.8} />
        ) : isRecording ? (
          <Mic
            className="h-7 w-7 text-red-500 relative z-10 drop-shadow-[0_0_10px_hsl(0_84%_65%/0.8)]"
            strokeWidth={2}
          />
        ) : (
          <MicOff className="h-6 w-6 text-muted-foreground/70 relative z-10" strokeWidth={1.5} />
        )}
      </motion.button>

      <AnimatePresence mode="wait">
        {isRecording && (
          <motion.div
            key="recording"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex flex-col items-center gap-2 w-full"
          >
            <LiveWaveform analyser={analyser} />
            <p className="text-xs text-primary/80 tracking-wide font-light">
              Записываю ваш поток...
            </p>
          </motion.div>
        )}
        {isTranscribing && (
          <motion.div
            key="transcribing"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2 text-xs text-primary/80 tracking-wide font-light"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Расшифровываю запись...</span>
          </motion.div>
        )}
        {error && !isRecording && !isTranscribing && (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-xs text-destructive/80 text-center max-w-[240px]"
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

// --- Session Stage Panel (vertical luxury path) ---
function SessionStagePanel({
  number,
  title,
  subtitle,
  Icon,
  completed,
  locked,
  active,
  onClick,
}: {
  number: number;
  title: string;
  subtitle: string;
  Icon: typeof Compass;
  completed: boolean;
  locked: boolean;
  active: boolean;
  onClick: () => void;
}) {
  const numberStr = String(number).padStart(2, "0");

  return (
    <motion.button
      whileHover={locked ? {} : { scale: 1.005 }}
      whileTap={locked ? {} : { scale: 0.99 }}
      onClick={locked ? undefined : onClick}
      disabled={locked}
      className={`relative w-full text-left rounded-[1.75rem] px-5 py-5 backdrop-blur-2xl border transition-all duration-500 ${
        locked
          ? "opacity-40 cursor-not-allowed border-white/15 bg-white/10"
          : completed
            ? "border-white/40 bg-white/30 shadow-[0_0_24px_4px_rgba(255,180,80,0.18)]"
            : active
              ? "border-white/50 bg-white/35 shadow-[0_0_28px_6px_rgba(212,160,90,0.28),0_0_40px_10px_rgba(168,139,250,0.18)]"
              : "opacity-50 border-white/20 bg-white/15"
      }`}
    >
      <div className="flex items-center gap-4">
        <Icon
          className={`h-7 w-7 shrink-0 transition-colors duration-500 ${
            active ? "text-violet-deep" : completed ? "text-primary/80" : "text-muted-foreground/70"
          }`}
          strokeWidth={1.4}
        />
        <span
          className={`font-serif text-3xl leading-none tracking-tight transition-colors duration-500 ${
            active ? "text-violet-deep" : completed ? "text-foreground/80" : "text-muted-foreground/60"
          }`}
        >
          {numberStr}
        </span>
        <div className="flex-1 min-w-0">
          <p
            className={`font-serif text-[15px] tracking-wide transition-colors duration-500 ${
              active ? "text-foreground" : completed ? "text-foreground/85" : "text-muted-foreground/80"
            }`}
          >
            {title}
          </p>
          <p
            className={`mt-1 italic text-[12px] leading-snug transition-colors duration-500 ${
              active ? "text-primary/80" : "text-muted-foreground/60"
            }`}
          >
            {subtitle}
          </p>
        </div>
        {completed && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary/80 flex items-center justify-center shadow-md"
          >
            <Check className="h-3 w-3 text-white" strokeWidth={3} />
          </motion.div>
        )}
        {locked && (
          <Lock className="absolute top-4 right-4 h-3.5 w-3.5 text-foreground/30" strokeWidth={1.6} />
        )}
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
  const [moodScoreBefore, setMoodScoreBefore] = useState(0);
  const [moodsBefore, setMoodsBefore] = useState<string[]>([]);
  // Oil contact (sensory)
  const [oilBodyZones, setOilBodyZones] = useState<string[]>([]);
  const [oilSensation, setOilSensation] = useState("");
  const [oilVisualImage, setOilVisualImage] = useState("");

  // After state
  const [moodScoreAfter, setMoodScoreAfter] = useState(0);
  const [moodsAfter, setMoodsAfter] = useState<string[]>([]);
  const [aromaMatch, setAromaMatch] = useState<string | null>(null);
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
    // New flow: after breath go straight into free writing,
    // then sensory, then final "after" measurement.
    setPhase("writing");
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
    setMoodScoreBefore(0);
    setMoodsBefore([]);
    
    setOilBodyZones([]);
    setOilSensation("");
    setOilVisualImage("");
    setMoodScoreAfter(0);
    setMoodsAfter([]);
    setAromaMatch(null);
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
        mood:
          moodsBefore.length || moodsAfter.length
            ? JSON.stringify({ before: moodsBefore, after: moodsAfter })
            : null,
        content: content.trim(),
        is_public: isPublic,
        energy_tags: [],
        sensation: null,
        record_type: recordType,
        oil_body_location: oilBodyZones.length > 0 ? JSON.stringify(oilBodyZones) : null,
        oil_sensation: oilSensation.trim() || null,
        oil_visual_image: oilVisualImage.trim() || null,
        energy_before: null,
        energy_after: null,
        aroma_match: aromaMatch,
        ...(date ? { date } : {}),
      };

      if (recordType === "full") {
        entryData.mood_score_before = moodScoreBefore;
        entryData.mood_score_after = moodScoreAfter;
      }

      const { error } = await supabase.from("entries").insert(entryData as any);
      if (error) {
        console.error("Entry save error:", error);
        throw error;
      }

      // Entry saved successfully, now try to get insight
      let insight: string | null = null;
      let quote: string | null = null;
      try {
        const { data, error: fnError } = await supabase.functions.invoke("generate-insight", {
          body: { oilId },
        });
        if (fnError) {
          console.error("Insight function error:", fnError);
        }
        if (data?.insight) {
          insight = data.insight;
          quote = data.shareQuote || null;
        }
      } catch (e) {
        console.error("Insight generation failed:", e);
      }
      return { insight, quote };
    },
    onSuccess: (result) => {
      toast.success("Запись сохранена ✨");

      // Invalidate caches so Diary/Calendar/Field instantly pick up the new entry
      queryClient.invalidateQueries({ queryKey: ["entries", oilId] });
      queryClient.invalidateQueries({ queryKey: ["public-entries", oilId] });
      queryClient.invalidateQueries({ queryKey: ["ai-insights-history", oilId] });
      queryClient.invalidateQueries({ queryKey: ["ai-insights-by-date", oilId] });
      queryClient.invalidateQueries({ queryKey: ["entries-count", oilId] });
      queryClient.invalidateQueries({ queryKey: ["group-mood-agg", oilId] });

      // HARD RESET — wipe all session form state so the next session starts as tabula rasa.
      // Insight text/phase are intentionally set AFTER the reset so the insight screen still renders.
      setBeforeDone(false);
      setContactDone(false);
      setAfterDone(false);
      setWritingDone(false);
      setSkipBefore(false);
      setMoodScoreBefore(0);
      setMoodsBefore([]);
      setOilBodyZones([]);
      setOilSensation("");
      setOilVisualImage("");
      setMoodScoreAfter(0);
      setMoodsAfter([]);
      setAromaMatch(null);
      setContent("");
      setIsPublic(false);

      // Clear any local draft if one exists (defensive — no draft key is currently used)
      try {
        localStorage.removeItem(`diary_draft_${oilId}`);
        sessionStorage.removeItem(`diary_draft_${oilId}`);
      } catch {
        /* storage unavailable — ignore */
      }

      if (result?.insight) {
        setInsightText(result.insight);
        setShareQuote(result.quote);
        setPhase("insight");
      } else {
        setInsightText("Запись сохранена. Инсайт будет доступен позже.");
        setShareQuote(null);
        setPhase("insight");
      }
    },
    onError: (error: any) => {
      console.error("Session save failed:", error);
      toast.error(`Не удалось сохранить: ${error?.message || "Неизвестная ошибка"}`);
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
            <div className="text-center mb-4">
              <h3 className="font-serif text-[26px] sm:text-[28px] leading-tight tracking-tight text-foreground">
                Твоё пространство <span className="accent-italic text-primary">исследования</span>
              </h3>
            </div>

            <div className="flex flex-col gap-3.5">
              <SessionStagePanel
                number={1}
                title="Точка входа"
                subtitle="Замерь энергию и настроение до масла"
                Icon={Compass}
                completed={beforeDone}
                locked={false}
                active={!beforeDone}
                onClick={() => setPhase("before")}
              />
              <SessionStagePanel
                number={2}
                title="Контакт с Даваной"
                subtitle="Дыхание, сенсорика и образы"
                Icon={Flower2}
                completed={contactDone}
                locked={false}
                active={beforeDone && !contactDone}
                onClick={enterContact}
              />
              <SessionStagePanel
                number={3}
                title="Интеграция"
                subtitle="Свободный поток, сенсорика и финальный замер"
                Icon={Sprout}
                completed={afterDone && writingDone}
                locked={!contactDone}
                active={contactDone && !(afterDone && writingDone)}
                onClick={() => {
                  // New flow: writing → sensory → after
                  if (!writingDone) setPhase("writing");
                  else if (!contactDone) setPhase("sensory");
                  else if (beforeDone && !afterDone) setPhase("after");
                  else setPhase("writing");
                }}
              />
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="pt-2"
            >
              <button
                type="button"
                onClick={() => saveEntry()}
                disabled={!canFinishSession || !content.trim()}
                className="w-full rounded-full px-6 py-3.5 text-[13px] tracking-wide text-primary bg-white/10 backdrop-blur-xl border border-primary/30 shadow-[0_0_18px_2px_rgba(168,139,250,0.18)] transition-all duration-300 hover:bg-white/20 hover:shadow-[0_0_24px_4px_rgba(168,139,250,0.28)] hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                Завершить сессию и получить инсайт
              </button>
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
            <div className="glass-card p-6 rounded-[1.75rem] space-y-7">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Smile className="h-4 w-4 text-primary/60" strokeWidth={1.5} />
                  <span className="text-sm font-medium text-foreground/80">Состояние сейчас</span>
                </div>
                <EmotionalStateChips selected={moodsBefore} onChange={setMoodsBefore} />
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
            onComplete={() => {
              setContactDone(true);
              if (beforeDone && !afterDone) {
                setPhase("after");
              } else {
                setPhase("hub");
              }
            }}
            completeLabel={beforeDone && !afterDone ? "Далее — финальный замер" : "Завершить этап"}
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
            onComplete={() => completePhase("after")}
            completeLabel="Завершить этап"
          >
            <div className="glass-card p-6 rounded-[1.75rem] space-y-7">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Smile className="h-4 w-4 text-primary/60" strokeWidth={1.5} />
                  <span className="text-sm font-medium text-foreground/80">Состояние после</span>
                </div>
                <EmotionalStateChips selected={moodsAfter} onChange={setMoodsAfter} />
              </div>

              <div className="space-y-3 pt-2 border-t border-white/10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary/60" strokeWidth={1.5} />
                    <span className="text-sm font-medium text-foreground/80">Отклик на аромат</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/70 tracking-wide pl-6">
                    Насколько этот аромат совпадает с твоим текущим состоянием?
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "not_mine", emoji: "🥀", label: "Не откликается" },
                    { value: "neutral", emoji: "🌿", label: "Нейтрально" },
                    { value: "perfect_match", emoji: "✨", label: "Абсолютно моё" },
                  ].map((opt) => {
                    const isSelected = aromaMatch === opt.value;
                    return (
                      <motion.button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          if (navigator.vibrate) navigator.vibrate(8);
                          setAromaMatch(isSelected ? null : opt.value);
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className={`rounded-xl px-2 py-3 text-xs text-center backdrop-blur-md transition-all duration-300 flex flex-col items-center gap-1 focus:outline-none ${
                          isSelected
                            ? "bg-primary/20 text-primary border border-primary/60 shadow-[0_0_12px_rgba(168,139,250,0.3)]"
                            : "bg-white/5 text-foreground/70 border border-white/10 hover:bg-white/10"
                        }`}
                        style={{ WebkitTapHighlightColor: "transparent" }}
                      >
                        <span className="text-lg leading-none">{opt.emoji}</span>
                        <span className="leading-tight">{opt.label}</span>
                      </motion.button>
                    );
                  })}
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
            onComplete={() => {
              setWritingDone(true);
              if (!contactDone) {
                setPhase("sensory");
              } else if (beforeDone && !afterDone) {
                setPhase("after");
              } else {
                setPhase("hub");
              }
            }}
            completeLabel={!contactDone ? "Далее — Сенсорика" : beforeDone && !afterDone ? "Далее — финальный замер" : "Завершить этап"}
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
                  <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/85 font-light font-sans not-italic">{formatInsightText(insightText)}</p>
                </div>
              </motion.div>
            </div>

            <InsightShareCard
              insightText={insightText}
              shareQuote={shareQuote}
              moodBefore={JSON.stringify({ before: moodsBefore, after: moodsAfter })}
              moodAfter={JSON.stringify({ before: moodsBefore, after: moodsAfter })}
              energyBefore={null}
              energyAfter={null}
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
