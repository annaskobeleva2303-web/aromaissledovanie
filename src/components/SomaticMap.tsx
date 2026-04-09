import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

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

// SVG positions for glow orbs (relative to viewBox 0 0 200 500)
const ZONE_POSITIONS: Record<string, { cx: number; cy: number; r: number }> = {
  head:    { cx: 100, cy: 52, r: 30 },
  throat:  { cx: 100, cy: 100, r: 22 },
  chest:   { cx: 100, cy: 155, r: 35 },
  stomach: { cx: 100, cy: 220, r: 30 },
  pelvis:  { cx: 100, cy: 285, r: 28 },
  limbs:   { cx: 100, cy: 370, r: 35 },
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
          break; // count each zone only once per entry
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

  // Find the top zone
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

      {/* SVG Body + Glow */}
      <div className="relative flex justify-center py-4">
        <svg viewBox="0 0 200 460" className="w-40 h-auto" style={{ filter: "drop-shadow(0 0 10px hsla(263,72%,52%,0.1))" }}>
          {/* Ethereal body silhouette */}
          <path
            d="
              M100 20
              C112 20 120 30 120 42 C120 54 112 64 100 64 C88 64 80 54 80 42 C80 30 88 20 100 20 Z
              M100 64
              L100 70
              C100 70 85 75 78 90
              C72 105 65 100 55 115
              L48 130
              C48 130 42 135 48 140
              C54 145 58 140 58 140
              L75 120
              C75 120 80 115 82 125
              L85 190
              L82 260
              C80 280 78 300 80 320
              L82 380
              C82 390 78 405 75 420
              L72 445
              C72 450 78 455 82 450
              L95 390
              L100 370
              L105 390
              L118 450
              C122 455 128 450 128 445
              L125 420
              C122 405 118 390 118 380
              L120 320
              C122 300 120 280 118 260
              L115 190
              L118 125
              C120 115 125 120 125 120
              L142 140
              C142 140 146 145 152 140
              C158 135 152 130 152 130
              L145 115
              C135 100 128 105 122 90
              C115 75 100 70 100 70
              Z
            "
            fill="none"
            stroke="hsla(263,30%,70%,0.3)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* Glow orbs for each active zone */}
          {Object.entries(ZONE_POSITIONS).map(([zone, pos]) => {
            const count = zoneCounts[zone] || 0;
            if (count === 0) return null;
            const intensity = count / maxCount;
            const opacity = 0.2 + intensity * 0.6;
            const scale = 0.5 + intensity * 0.5;

            return (
              <g key={zone} onClick={() => setSelectedZone(zone === selectedZone ? null : zone)} className="cursor-pointer">
                <motion.circle
                  cx={pos.cx}
                  cy={pos.cy}
                  r={pos.r * scale}
                  fill={`url(#glow-${zone})`}
                  initial={{ opacity: 0, scale: 0.3 }}
                  animate={{
                    opacity,
                    scale: [1, 1.08, 1],
                  }}
                  transition={{
                    opacity: { duration: 0.8, delay: 0.1 },
                    scale: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                  }}
                />
                <defs>
                  <radialGradient id={`glow-${zone}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="hsla(35,90%,65%,0.9)" />
                    <stop offset="40%" stopColor="hsla(263,72%,60%,0.5)" />
                    <stop offset="100%" stopColor="hsla(263,72%,52%,0)" />
                  </radialGradient>
                </defs>
              </g>
            );
          })}
        </svg>
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

      {/* Default hint when nothing selected */}
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
