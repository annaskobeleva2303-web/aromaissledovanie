import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import somaticBody from "@/assets/somatic-body.png";

// Body zone keywords dictionary
const ZONE_KEYWORDS: Record<string, { keywords: string[]; label: string; description: string }> = {
  head: {
    keywords: ["голова", "виски", "лоб", "мозг", "затылок", "макушка", "темя", "череп"],
    label: "Голова",
    description: "Зона ясности, мыслей и связи с высшим",
  },
  throat: {
    keywords: ["горло", "шея", "голос", "кадык", "связки", "гортань"],
    label: "Горло и шея",
    description: "Зона самовыражения и правды",
  },
  chest: {
    keywords: ["грудь", "сердце", "дыхание", "рёбра", "ребра", "лопатки", "лёгкие", "легкие", "грудная"],
    label: "Грудь и сердце",
    description: "Зона чувств, любви и принятия",
  },
  stomach: {
    keywords: ["живот", "солнечное сплетение", "желудок", "пресс", "диафрагма", "пупок"],
    label: "Живот",
    description: "Зона силы, интуиции и внутреннего огня",
  },
  pelvis: {
    keywords: ["таз", "матка", "низ живота", "крестец", "копчик", "бёдра", "бедра", "пах"],
    label: "Таз и основание",
    description: "Зона заземления, корней и витальной энергии",
  },
  limbs: {
    keywords: ["руки", "ноги", "ладони", "стопы", "плечи", "колени", "пальцы", "запястья", "локти", "кисти"],
    label: "Конечности",
    description: "Зона действия, движения и контакта с миром",
  },
};

// Glow positions as percentages of the image container (top%, left%)
const ZONE_POSITIONS: Record<string, { top: number; left: number; size: number }> = {
  head:    { top: 8,  left: 50, size: 50 },
  throat:  { top: 17, left: 50, size: 40 },
  chest:   { top: 30, left: 50, size: 70 },
  stomach: { top: 43, left: 50, size: 60 },
  pelvis:  { top: 53, left: 50, size: 55 },
  limbs:   { top: 80, left: 50, size: 65 },
};

interface SomaticMapProps {
  entries: Array<{ oil_body_location: string | null }>;
}

function parseZoneFrequencies(entries: Array<{ oil_body_location: string | null }>) {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    if (!entry.oil_body_location) continue;
    const text = entry.oil_body_location.toLowerCase();
    for (const [zone, config] of Object.entries(ZONE_KEYWORDS)) {
      for (const keyword of config.keywords) {
        if (text.includes(keyword)) {
          counts[zone] = (counts[zone] || 0) + 1;
          break;
        }
      }
    }
  }
  return counts;
}

export function SomaticMap({ entries }: SomaticMapProps) {
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
          <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="3" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
            <line x1="12" y1="16" x2="9" y2="22" />
            <line x1="12" y1="16" x2="15" y2="22" />
          </svg>
        </div>
        <h3 className="font-serif text-base font-semibold tracking-wide text-foreground">
          Карта телесного отклика
        </h3>
      </div>

      {/* Body image with glow overlays */}
      <div className="relative flex justify-center py-4">
        <div className="relative w-48">
          <img
            src={somaticBody}
            alt="Силуэт тела"
            className="w-full h-auto relative z-10 pointer-events-none"
            style={{ filter: "drop-shadow(0 0 20px hsla(263,50%,70%,0.15))" }}
            loading="lazy"
            width={512}
            height={1024}
          />

          {/* Glow orbs positioned over the body */}
          {Object.entries(ZONE_POSITIONS).map(([zone, pos]) => {
            const count = zoneCounts[zone] || 0;
            if (count === 0) return null;
            const intensity = count / maxCount;
            const opacity = 0.3 + intensity * 0.6;
            const scale = 0.6 + intensity * 0.4;
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
                  background: `radial-gradient(circle, hsla(35,95%,65%,0.85) 0%, hsla(270,60%,58%,0.35) 50%, transparent 100%)`,
                  filter: `blur(${4 + (1 - intensity) * 6}px)`,
                }}
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{
                  opacity,
                  scale: [1, 1.08, 1],
                }}
                transition={{
                  opacity: { duration: 1, delay: 0.1 },
                  scale: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                }}
                onClick={() => setSelectedZone(zone === selectedZone ? null : zone)}
              />
            );
          })}
        </div>
      </div>

      {/* Selected zone info */}
      <AnimatePresence mode="wait">
        {selectedZone && ZONE_KEYWORDS[selectedZone] && (
          <motion.div
            key={selectedZone}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-white/30 bg-white/40 backdrop-blur-sm p-4 space-y-1 text-center"
          >
            <p className="text-sm font-serif font-semibold text-foreground">
              Главный фокус: {ZONE_KEYWORDS[selectedZone].label}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {ZONE_KEYWORDS[selectedZone].description}
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
            Главный фокус: <span className="font-semibold text-foreground/80">{ZONE_KEYWORDS[topZone[0]]?.label}</span>
          </p>
          <p className="text-[10px] text-muted-foreground/60">
            Нажмите на светящуюся зону для подробностей
          </p>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/50">
        На основе {entries.filter(e => e.oil_body_location).length} записей с указанием зон
      </p>
    </div>
  );
}
