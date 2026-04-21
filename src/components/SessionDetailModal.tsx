import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { motion } from "framer-motion";
import { X, Zap, Smile } from "lucide-react";
import { SomaticMap } from "@/components/SomaticMap";
import { InsightShareCard } from "@/components/InsightShareCard";
import { Button } from "@/components/ui/button";

const MOODS: Record<string, { label: string; emoji: string }> = {
  calm: { label: "Спокойствие", emoji: "😌" },
  anxious: { label: "Тревога", emoji: "😟" },
  joyful: { label: "Радость", emoji: "😊" },
  sad: { label: "Грусть", emoji: "😢" },
  energetic: { label: "Энергия", emoji: "⚡" },
  irritated: { label: "Раздражение", emoji: "😤" },
  reflective: { label: "Задумчивость", emoji: "🤔" },
  grateful: { label: "Благодарность", emoji: "🙏" },
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
  record_type: string;
}

interface SessionDetailModalProps {
  entry: SessionEntry;
  insight?: { content: string; share_quote: string | null } | null;
  onClose: () => void;
}

function getMoodEmoji(mood: string | null) {
  if (!mood) return "—";
  return MOODS[mood]?.emoji || "•";
}

export function SessionDetailModal({ entry, insight, onClose }: SessionDetailModalProps) {
  const dateFormatted = format(parseISO(entry.date), "d MMMM yyyy", { locale: ru });
  const isFull = entry.record_type === "full";
  const hasTransformation = isFull && entry.energy_before != null && entry.energy_after != null;

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

      {/* Transformation block */}
      {hasTransformation && (
        <div
          className="rounded-[1.75rem] border border-white/25 p-5 backdrop-blur-2xl space-y-3"
          style={{
            background: "linear-gradient(135deg, hsla(160,50%,92%,0.5) 0%, hsla(0,0%,100%,0.4) 50%, hsla(35,90%,90%,0.4) 100%)",
          }}
        >
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Трансформация
          </p>
          <div className="flex items-center justify-center gap-6">
            {/* Before */}
            <div className="text-center space-y-1">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">До</p>
              <span className="text-3xl">{getMoodEmoji(entry.mood)}</span>
              <div className="flex items-center gap-1 justify-center">
                <Zap className="h-3 w-3 text-amber-500" />
                <span className="text-xs font-medium">{entry.energy_before}</span>
              </div>
              <div className="flex items-center gap-1 justify-center">
                <Smile className="h-3 w-3 text-primary" />
                <span className="text-xs font-medium">{entry.mood_score_before! > 0 ? "+" : ""}{entry.mood_score_before}</span>
              </div>
            </div>

            <span className="text-2xl text-muted-foreground/30">→</span>

            {/* After */}
            <div className="text-center space-y-1">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">После</p>
              <span className="text-3xl">{getMoodEmoji(entry.mood)}</span>
              <div className="flex items-center gap-1 justify-center">
                <Zap className="h-3 w-3 text-amber-500" />
                <span className="text-xs font-medium">{entry.energy_after}</span>
              </div>
              <div className="flex items-center gap-1 justify-center">
                <Smile className="h-3 w-3 text-primary" />
                <span className="text-xs font-medium">{entry.mood_score_after! > 0 ? "+" : ""}{entry.mood_score_after}</span>
              </div>
            </div>
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
            moodAfter={null}
            energyBefore={entry.energy_before}
            energyAfter={entry.energy_after}
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
