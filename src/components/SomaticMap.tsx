import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User } from "lucide-react";
import somaticBody from "@/assets/somatic-body.png";
import { BODY_ZONES } from "@/components/BodyZoneChips";

// Zone metadata for display
const ZONE_META: Record<string, { label: string; description: string }> = {
  head: { label: "Голова", description: "Зона ясности, мыслей и связи с высшим" },
  throat: { label: "Горло и шея", description: "Зона самовыражения и правды" },
  chest: { label: "Грудь и сердце", description: "Зона чувств, любви и принятия" },
  stomach: { label: "Живот", description: "Зона силы, интуиции и внутреннего огня" },
  pelvis: { label: "Таз и основание", description: "Зона заземления, корней и витальной энергии" },
  arms: { label: "Руки", description: "Зона действия, контакта и творчества" },
  legs: { label: "Ноги", description: "Зона движения, опоры и заземления" },
};

// Legacy keyword mapping for old text-based entries
const ZONE_KEYWORDS: Record<string, string[]> = {
  head: ["голова", "виски", "лоб", "мозг", "затылок", "макушка", "темя", "череп"],
  throat: ["горло", "шея", "голос", "кадык", "связки", "гортань"],
  chest: ["грудь", "сердце", "дыхание", "рёбра", "ребра", "лопатки", "лёгкие", "легкие", "грудная"],
  stomach: ["живот", "солнечное сплетение", "желудок", "пресс", "диафрагма", "пупок"],
  pelvis: ["таз", "матка", "низ живота", "крестец", "копчик", "бёдра", "бедра", "пах"],
  arms: ["руки", "ладони", "плечи", "пальцы", "запястья", "локти", "кисти"],
  legs: ["ноги", "стопы", "колени", "голени", "ступни"],
};

// Glow positions as percentages of image container
const ZONE_POSITIONS: Record<string, { top: number; left: number; size: number }> = {
  head:    { top: 8,  left: 50, size: 50 },
  throat:  { top: 17, left: 50, size: 40 },
  chest:   { top: 30, left: 50, size: 60 },
  stomach: { top: 43, left: 50, size: 55 },
  pelvis:  { top: 53, left: 50, size: 50 },
  arms:    { top: 38, left: 50, size: 70 },
  legs:    { top: 78, left: 50, size: 55 },
};

interface SomaticMapProps {
  entries: Array<{ oil_body_location: string | null }>;
  periodLabel?: string;
}

function parseZoneFrequencies(entries: Array<{ oil_body_location: string | null }>) {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    if (!entry.oil_body_location) continue;
    const raw = entry.oil_body_location;

    // Try JSON array first (new format)
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const zoneId of parsed) {
          if (typeof zoneId === "string" && ZONE_POSITIONS[zoneId]) {
            counts[zoneId] = (counts[zoneId] || 0) + 1;
          }
        }
        continue;
      }
    } catch {
      // Not JSON, fall through to keyword matching
    }

    // Legacy: keyword-based text matching
    const text = raw.toLowerCase();
    for (const [zone, keywords] of Object.entries(ZONE_KEYWORDS)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          counts[zone] = (counts[zone] || 0) + 1;
          break;
        }
      }
    }
  }
  return counts;
}

export function SomaticMap({ entries, periodLabel }: SomaticMapProps) {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const { zoneCounts, maxCount, hasData } = useMemo(() => {
    const zoneCounts = parseZoneFrequencies(entries);
    const maxCount = Math.max(...Object.values(zoneCounts), 1);
    const hasData = Object.keys(zoneCounts).length > 0;
    return { zoneCounts, maxCount, hasData };
  }, [entries]);

  if (!hasData) {
    return (
      <div
        className="relative overflow-hidden rounded-3xl border border-white/25 p-6 text-center space-y-3"
        style={{
          background: "linear-gradient(135deg, hsla(263,50%,95%,0.5) 0%, hsla(0,0%,100%,0.4) 100%)",
          backdropFilter: "blur(24px)",
          boxShadow: "inset 0 1px 0 hsla(0,0%,100%,0.5)",
        }}
      >
        <p className="text-sm text-muted-foreground">
          Данные о телесном отклике появятся после нескольких сессий с указанием зон тела.
        </p>
      </div>
    );
  }

  const topZone = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1])[0];
  const totalWithLocation = entries.filter(e => e.oil_body_location).length;

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-white/25 p-6 space-y-4"
      style={{
        background: "linear-gradient(135deg, hsla(263,50%,95%,0.5) 0%, hsla(0,0%,100%,0.4) 50%, hsla(35,90%,92%,0.4) 100%)",
        backdropFilter: "blur(24px)",
        boxShadow: "inset 0 1px 0 hsla(0,0%,100%,0.5)",
      }}
    >
      <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />

      {/* Header */}
      <div className="relative flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <User className="h-5 w-5 text-primary" strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="font-serif text-base font-semibold tracking-wide text-foreground">
            Карта телесного отклика
          </h3>
          {periodLabel && (
            <p className="text-[10px] text-muted-foreground/60">{periodLabel}</p>
          )}
        </div>
      </div>

      {/* Body image with glow overlays */}
      <div className="relative flex justify-center py-4">
        <div className="relative w-52" style={{ overflow: "hidden" }}>
          <img
            src={somaticBody}
            alt="Силуэт тела"
            className="w-full h-auto relative z-10 pointer-events-none"
            style={{ filter: "drop-shadow(0 0 20px hsla(263,50%,70%,0.15))" }}
            loading="lazy"
            width={512}
            height={1024}
          />

          {/* Glow orbs — strictly inside the container */}
          {Object.entries(ZONE_POSITIONS).map(([zone, pos]) => {
            const count = zoneCounts[zone] || 0;
            if (count === 0) return null;
            const intensity = count / maxCount;
            const opacity = 0.25 + intensity * 0.55;
            const scale = 0.7 + intensity * 0.3;
            const size = pos.size * scale;

            return (
              <motion.div
                key={zone}
                className="absolute z-20 cursor-pointer rounded-full"
                style={{
                  top: `${pos.top}%`,
                  left: `${pos.left}%`,
                  width: size,
                  height: size,
                  transform: "translate(-50%, -50%)",
                  background: `radial-gradient(circle, hsla(35,95%,65%,0.7) 0%, hsla(270,60%,58%,0.3) 45%, transparent 100%)`,
                  filter: `blur(${6 + (1 - intensity) * 8}px)`,
                }}
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{
                  opacity,
                  scale: [1, 1.06, 1],
                }}
                transition={{
                  opacity: { duration: 1, delay: 0.1 },
                  scale: { duration: 5, repeat: Infinity, ease: "easeInOut" },
                }}
                onClick={() => setSelectedZone(zone === selectedZone ? null : zone)}
              />
            );
          })}
        </div>
      </div>

      {/* Selected zone info */}
      <AnimatePresence mode="wait">
        {selectedZone && ZONE_META[selectedZone] && (
          <motion.div
            key={selectedZone}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-white/30 bg-white/40 backdrop-blur-sm p-4 space-y-1 text-center"
          >
            <p className="text-sm font-serif font-semibold text-foreground">
              Главный фокус: {ZONE_META[selectedZone].label}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {ZONE_META[selectedZone].description}
            </p>
            <p className="text-[10px] text-primary font-medium">
              Упоминаний: {zoneCounts[selectedZone] || 0}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Default hint */}
      {!selectedZone && topZone && (
        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground">
            Главный фокус: <span className="font-semibold text-foreground/80">{ZONE_META[topZone[0]]?.label}</span>
          </p>
          <p className="text-[10px] text-muted-foreground/60">
            Нажмите на светящуюся зону для подробностей
          </p>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/50">
        На основе {totalWithLocation} записей с указанием зон
      </p>
    </div>
  );
}
