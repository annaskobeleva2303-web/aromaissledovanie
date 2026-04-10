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

// Zone positions mapped to the new silhouette (viewBox 0 0 200 440)
const ZONE_POSITIONS: Record<string, { cx: number; cy: number; r: number }> = {
  head:    { cx: 100, cy: 32, r: 18 },
  throat:  { cx: 100, cy: 62, r: 14 },
  chest:   { cx: 100, cy: 110, r: 30 },
  stomach: { cx: 100, cy: 170, r: 26 },
  pelvis:  { cx: 100, cy: 220, r: 22 },
  limbs:   { cx: 100, cy: 340, r: 28 },
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

      {/* SVG Body */}
      <div className="relative flex justify-center py-4">
        <svg viewBox="0 0 200 440" className="w-48 h-auto" style={{ filter: "drop-shadow(0 0 30px hsla(263,60%,60%,0.15))" }}>
          <defs>
            {/* Body fill — translucent crystalline */}
            <linearGradient id="body-fill" x1="0.5" y1="0" x2="0.5" y2="1">
              <stop offset="0%" stopColor="hsla(263,45%,88%,0.6)" />
              <stop offset="30%" stopColor="hsla(263,40%,82%,0.45)" />
              <stop offset="60%" stopColor="hsla(280,35%,85%,0.35)" />
              <stop offset="100%" stopColor="hsla(263,30%,90%,0.5)" />
            </linearGradient>
            {/* Inner light shimmer */}
            <radialGradient id="body-shimmer" cx="50%" cy="35%" r="45%">
              <stop offset="0%" stopColor="hsla(0,0%,100%,0.25)" />
              <stop offset="100%" stopColor="hsla(0,0%,100%,0)" />
            </radialGradient>
            {/* Glow for active zones — amber core + purple halo */}
            {Object.keys(ZONE_POSITIONS).map((zone) => (
              <radialGradient key={zone} id={`glow-${zone}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsla(35,95%,65%,0.9)" />
                <stop offset="30%" stopColor="hsla(35,80%,60%,0.5)" />
                <stop offset="60%" stopColor="hsla(270,60%,60%,0.3)" />
                <stop offset="100%" stopColor="hsla(270,50%,60%,0)" />
              </radialGradient>
            ))}
            {/* Clip to body */}
            <clipPath id="body-clip">
              <use href="#body-shape" />
            </clipPath>
          </defs>

          {/* 
            Clean, anatomically smooth silhouette — sculpted, feminine, 
            inspired by the reference crystal figure. Front-facing, arms at sides.
          */}
          <g id="body-shape">
            {/* Head */}
            <ellipse cx="100" cy="30" rx="16" ry="19" />
            {/* Neck */}
            <rect x="93" y="48" width="14" height="12" rx="4" />
            {/* Torso — smooth tapered shape */}
            <path d="
              M 68 60
              C 68 60, 60 62, 56 70
              C 52 78, 54 82, 56 84
              L 62 80
              L 66 74
              L 70 72
              L 72 90
              L 70 120
              L 68 150
              L 66 180
              C 64 195, 66 210, 70 225
              L 74 235
              C 80 240, 90 242, 100 242
              C 110 242, 120 240, 126 235
              L 130 225
              C 134 210, 136 195, 134 180
              L 132 150
              L 130 120
              L 128 90
              L 130 72
              L 134 74
              L 138 80
              L 144 84
              C 146 82, 148 78, 144 70
              C 140 62, 132 60, 132 60
              L 120 58
              L 108 56
              L 100 55
              L 92 56
              L 80 58
              Z
            " />
            {/* Left arm */}
            <path d="
              M 66 74
              C 60 80, 52 100, 48 130
              C 44 160, 42 190, 42 210
              C 42 220, 40 240, 38 260
              C 36 275, 34 285, 36 290
              C 38 295, 42 295, 44 290
              C 46 285, 46 275, 48 260
              C 50 240, 52 220, 54 200
              C 56 180, 60 160, 64 140
              L 70 120
            " />
            {/* Right arm */}
            <path d="
              M 134 74
              C 140 80, 148 100, 152 130
              C 156 160, 158 190, 158 210
              C 158 220, 160 240, 162 260
              C 164 275, 166 285, 164 290
              C 162 295, 158 295, 156 290
              C 154 285, 154 275, 152 260
              C 150 240, 148 220, 146 200
              C 144 180, 140 160, 136 140
              L 130 120
            " />
            {/* Left leg */}
            <path d="
              M 82 238
              C 80 255, 78 275, 76 295
              C 74 315, 74 335, 74 355
              C 74 370, 72 385, 70 400
              C 68 410, 66 418, 68 422
              C 70 428, 76 428, 80 424
              C 82 420, 82 415, 82 405
              C 82 395, 82 380, 84 360
              C 86 340, 88 320, 90 300
              L 94 260
            " />
            {/* Right leg */}
            <path d="
              M 118 238
              C 120 255, 122 275, 124 295
              C 126 315, 126 335, 126 355
              C 126 370, 128 385, 130 400
              C 132 410, 134 418, 132 422
              C 130 428, 124 428, 120 424
              C 118 420, 118 415, 118 405
              C 118 395, 118 380, 116 360
              C 114 340, 112 320, 110 300
              L 106 260
            " />
          </g>

          {/* Render the filled body */}
          <use href="#body-shape" fill="url(#body-fill)" />
          {/* Shimmer overlay */}
          <use href="#body-shape" fill="url(#body-shimmer)" />
          {/* Outline — subtle purple */}
          <use
            href="#body-shape"
            fill="none"
            stroke="hsla(263,50%,65%,0.5)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* Energy glow orbs, clipped inside body */}
          <g clipPath="url(#body-clip)">
            {Object.entries(ZONE_POSITIONS).map(([zone, pos]) => {
              const count = zoneCounts[zone] || 0;
              if (count === 0) return null;
              const intensity = count / maxCount;
              const opacity = 0.3 + intensity * 0.65;
              const scale = 0.6 + intensity * 0.4;

              return (
                <g key={zone} onClick={() => setSelectedZone(zone === selectedZone ? null : zone)} className="cursor-pointer">
                  {/* Outer purple halo */}
                  <motion.circle
                    cx={pos.cx}
                    cy={pos.cy}
                    r={pos.r * scale * 1.6}
                    fill={`url(#glow-${zone})`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: opacity * 0.3 }}
                    transition={{ duration: 1.2, delay: 0.2 }}
                  />
                  {/* Main amber-core glow */}
                  <motion.circle
                    cx={pos.cx}
                    cy={pos.cy}
                    r={pos.r * scale}
                    fill={`url(#glow-${zone})`}
                    initial={{ opacity: 0, scale: 0.3 }}
                    animate={{
                      opacity,
                      scale: [1, 1.05, 1],
                    }}
                    transition={{
                      opacity: { duration: 1, delay: 0.1 },
                      scale: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                    }}
                  />
                </g>
              );
            })}
          </g>
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
