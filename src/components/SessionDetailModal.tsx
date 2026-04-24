import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { SomaticMap } from "@/components/SomaticMap";
import { InsightShareCard } from "@/components/InsightShareCard";
import { Button } from "@/components/ui/button";
import { parseMoodField, parseMoodPair, getEmojiForStateName } from "@/utils/stateUtils";

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

interface SessionEntry {
  date: string;
  content: string;
  mood: string | null;
  created_at: string;
  energy_before: number | null;
  energy_after: number | null;
  mood_score_before: number | null;
  mood_score_after: number | null;
  oil_body_location: string | null;
  oil_sensation: string | null;
  oil_visual_image: string | null;
  aroma_match?: string | null;
  record_type: string;
}

const AROMA_MATCH_MAP: Record<string, { emoji: string; label: string }> = {
  not_mine: { emoji: "🥀", label: "Не откликается" },
  neutral: { emoji: "🌿", label: "Нейтрально" },
  perfect_match: { emoji: "✨", label: "Абсолютно моё" },
};

interface SessionDetailModalProps {
  entry: SessionEntry;
  insight?: { content: string; share_quote: string | null } | null;
  onClose: () => void;
}

export function SessionDetailModal({ entry, insight, onClose }: SessionDetailModalProps) {
  const dateFormatted = format(parseISO(entry.date), "d MMMM yyyy", { locale: ru });
  const isFull = entry.record_type === "full";
  const moodPair = parseMoodPair(entry.mood);
  const legacyStates = parseMoodField(entry.mood);
  const beforeStates = moodPair.before;
  const afterStates =
    moodPair.after.length > 0 ? moodPair.after : legacyStates;
  const hasTransformation =
    beforeStates.length > 0 && afterStates.length > 0;
  const hasAfterOnly = !hasTransformation && afterStates.length > 0;

  // Parse body zones
  let bodyZones: string[] = [];
  if (entry.oil_body_location) {
    try {
      const parsed = JSON.parse(entry.oil_body_location);
      if (Array.isArray(parsed)) bodyZones = parsed;
      else bodyZones = [entry.oil_body_location];
    } catch {
      bodyZones = [entry.oil_body_location];
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-primary/60 font-medium">
            Детали сессии
          </p>
          <h3 className="font-serif text-lg tracking-wide text-foreground/90">{dateFormatted}</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-9 w-9">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Transformation block: Before → After */}
      {hasTransformation && (
        <div
          className="rounded-[1.75rem] border border-white/25 p-5 backdrop-blur-2xl space-y-4"
          style={{
            background: "linear-gradient(135deg, hsla(160,50%,92%,0.5) 0%, hsla(0,0%,100%,0.4) 50%, hsla(35,90%,90%,0.4) 100%)",
          }}
        >
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium text-center">
            Трансформация
          </p>
          <div className="flex items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-1.5 max-w-[110px]">
              <span className="text-3xl leading-none">{getEmojiForStateName(beforeStates[0])}</span>
              <p className="text-xs font-serif italic text-foreground/85 text-center">{beforeStates[0]}</p>
              <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/60">До</p>
            </div>
            <span className="text-xl text-primary/60">➔</span>
            <div className="flex flex-col items-center gap-1.5 max-w-[110px]">
              <span className="text-3xl leading-none">{getEmojiForStateName(afterStates[0])}</span>
              <p className="text-xs font-serif italic text-foreground/85 text-center">{afterStates[0]}</p>
              <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/60">После</p>
            </div>
          </div>
        </div>
      )}

      {/* Single-snapshot block (legacy entries without "before") */}
      {hasAfterOnly && (
        <div
          className="rounded-[1.75rem] border border-white/25 p-5 backdrop-blur-2xl space-y-4"
          style={{
            background: "linear-gradient(135deg, hsla(160,50%,92%,0.5) 0%, hsla(0,0%,100%,0.4) 50%, hsla(35,90%,90%,0.4) 100%)",
          }}
        >
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Состояние
          </p>
          <div className="flex flex-wrap items-center justify-center gap-5">
            {afterStates.map((state, idx) => (
              <div key={`${state}-${idx}`} className="flex flex-col items-center gap-1.5">
                <span className="text-3xl leading-none">{getEmojiForStateName(state)}</span>
                <p className="text-xs font-serif italic text-foreground/85">{state}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Somatic Map for this day */}
      {bodyZones.length > 0 && (
        <SomaticMap
          entries={[{ oil_body_location: entry.oil_body_location }]}
          periodLabel={`Отклик за ${format(parseISO(entry.date), "d MMMM", { locale: ru })}`}
          singleDay
        />
      )}

      {/* Sensory block */}
      {(entry.oil_sensation || entry.oil_visual_image) && (
        <div
          className="rounded-[1.75rem] border border-white/25 p-5 backdrop-blur-2xl space-y-3"
          style={{
            background: "linear-gradient(135deg, hsla(263,50%,95%,0.5) 0%, hsla(0,0%,100%,0.4) 100%)",
          }}
        >
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Сенсорика
          </p>
          {entry.oil_sensation && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground/60">Ощущения</p>
              <p className="text-sm text-foreground/85">{entry.oil_sensation}</p>
            </div>
          )}
          {entry.oil_visual_image && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground/60">Образ</p>
              <p className="text-sm text-foreground/85">{entry.oil_visual_image}</p>
            </div>
          )}
        </div>
      )}

      {/* Aroma match */}
      {entry.aroma_match && AROMA_MATCH_MAP[entry.aroma_match] && (
        <div
          className="rounded-[1.75rem] border border-white/25 p-5 backdrop-blur-2xl space-y-3"
          style={{
            background: "linear-gradient(135deg, hsla(35,90%,92%,0.45) 0%, hsla(0,0%,100%,0.4) 100%)",
          }}
        >
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Отклик на аромат
          </p>
          <div className="flex items-center gap-3 rounded-2xl bg-white/30 backdrop-blur-xl px-4 py-3 border border-white/20">
            <span className="text-2xl leading-none">{AROMA_MATCH_MAP[entry.aroma_match].emoji}</span>
            <p className="text-sm font-serif italic text-foreground/85">
              {AROMA_MATCH_MAP[entry.aroma_match].label}
            </p>
          </div>
        </div>
      )}

      {/* Free writing */}
      {entry.content && (
        <div
          className="rounded-[1.75rem] border border-white/25 p-5 backdrop-blur-2xl space-y-2"
          style={{
            background: "linear-gradient(135deg, hsla(20,90%,92%,0.4) 0%, hsla(0,0%,100%,0.4) 100%)",
          }}
        >
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Свободный поток
          </p>
          <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap">
            {entry.content}
          </p>
        </div>
      )}

      {/* AI Insight */}
      {insight?.content && (
        <div className="space-y-3">
          <div
            className="rounded-[1.75rem] border border-white/25 p-5 backdrop-blur-2xl space-y-2"
            style={{
              background: "linear-gradient(135deg, hsla(263,50%,92%,0.5) 0%, hsla(0,0%,100%,0.4) 50%, hsla(20,90%,88%,0.4) 100%)",
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
              Послание Даваны
            </p>
            <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap font-sans not-italic">
              {formatInsightText(insight.content)}
            </p>
          </div>
          <InsightShareCard
            insightText={insight.content}
            shareQuote={insight.share_quote}
            moodBefore={entry.mood}
            moodAfter={entry.mood}
            energyBefore={null}
            energyAfter={null}
          />
        </div>
      )}

      <Button
        variant="ghost"
        onClick={onClose}
        className="w-full rounded-full text-sm text-muted-foreground"
      >
        Закрыть
      </Button>
    </motion.div>
  );
}
