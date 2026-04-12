import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User } from "lucide-react";
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

interface SomaticMapProps {
  entries: Array<{ oil_body_location: string | null }>;
  periodLabel?: string;
}

function parseZoneFrequencies(entries: Array<{ oil_body_location: string | null }>) {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    if (!entry.oil_body_location) continue;
    const raw = entry.oil_body_location;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const zoneId of parsed) {
          if (typeof zoneId === "string" && ZONE_META[zoneId]) {
            counts[zoneId] = (counts[zoneId] || 0) + 1;
          }
        }
        continue;
      }
    } catch {
      // Not JSON, fall through to keyword matching
    }
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

/* ─── Segmented SVG Body ─── */
function BodySVG({
  activeZones,
  onZoneClick,
}: {
  activeZones: Record<string, number>;
  onZoneClick: (zone: string) => void;
}) {
  const maxCount = Math.max(...Object.values(activeZones), 1);

  const getIntensity = (zone: string) => {
    const count = activeZones[zone] || 0;
    if (count === 0) return 0;
    return 0.4 + (count / maxCount) * 0.6;
  };

  return (
    <svg
      viewBox="0 0 200 500"
      className="w-48 h-auto mx-auto"
      style={{ filter: "drop-shadow(0 0 24px hsla(263,50%,70%,0.15))" }}
    >
      <defs>
        {/* Base body gradient — frosted glass look */}
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsla(270,40%,85%,0.6)" />
          <stop offset="50%" stopColor="hsla(270,30%,90%,0.5)" />
          <stop offset="100%" stopColor="hsla(270,40%,82%,0.55)" />
        </linearGradient>
        {/* Active glow gradient */}
        <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsla(35,95%,65%,0.85)" />
          <stop offset="50%" stopColor="hsla(300,60%,58%,0.4)" />
          <stop offset="100%" stopColor="hsla(270,60%,58%,0.05)" />
        </radialGradient>
        {/* Soft blur filter for active zones */}
        <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Outline shimmer */}
        <linearGradient id="outlineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsla(270,60%,80%,0.5)" />
          <stop offset="100%" stopColor="hsla(270,40%,70%,0.2)" />
        </linearGradient>
      </defs>

      {/* ─── HEAD ─── */}
      <path
        id="head"
        d="M100,18 C116,18 128,32 128,50 C128,68 116,80 100,80 C84,80 72,68 72,50 C72,32 84,18 100,18 Z"
        fill="url(#bodyGrad)"
        stroke="url(#outlineGrad)"
        strokeWidth="0.8"
        className="somatic-zone"
        style={{
          cursor: "pointer",
          ...(getIntensity("head") > 0 ? { fill: "url(#glowGrad)", filter: "url(#softGlow)" } : {}),
        }}
        opacity={getIntensity("head") > 0 ? getIntensity("head") : 1}
        onClick={() => onZoneClick("head")}
      >
        {getIntensity("head") > 0 && (
          <animate attributeName="opacity" values={`${getIntensity("head")};${getIntensity("head") * 0.7};${getIntensity("head")}`} dur="4s" repeatCount="indefinite" />
        )}
      </path>

      {/* ─── THROAT / NECK ─── */}
      <path
        id="throat"
        d="M90,80 L110,80 L108,100 L92,100 Z"
        fill="url(#bodyGrad)"
        stroke="url(#outlineGrad)"
        strokeWidth="0.8"
        className="somatic-zone"
        style={{
          cursor: "pointer",
          ...(getIntensity("throat") > 0 ? { fill: "url(#glowGrad)", filter: "url(#softGlow)" } : {}),
        }}
        opacity={getIntensity("throat") > 0 ? getIntensity("throat") : 1}
        onClick={() => onZoneClick("throat")}
      >
        {getIntensity("throat") > 0 && (
          <animate attributeName="opacity" values={`${getIntensity("throat")};${getIntensity("throat") * 0.7};${getIntensity("throat")}`} dur="4s" repeatCount="indefinite" />
        )}
      </path>

      {/* ─── CHEST ─── */}
      <path
        id="chest"
        d="M60,100 L140,100 L145,110 C148,120 148,140 142,160 L100,165 L58,160 C52,140 52,120 55,110 Z"
        fill="url(#bodyGrad)"
        stroke="url(#outlineGrad)"
        strokeWidth="0.8"
        className="somatic-zone"
        style={{
          cursor: "pointer",
          ...(getIntensity("chest") > 0 ? { fill: "url(#glowGrad)", filter: "url(#softGlow)" } : {}),
        }}
        opacity={getIntensity("chest") > 0 ? getIntensity("chest") : 1}
        onClick={() => onZoneClick("chest")}
      >
        {getIntensity("chest") > 0 && (
          <animate attributeName="opacity" values={`${getIntensity("chest")};${getIntensity("chest") * 0.7};${getIntensity("chest")}`} dur="4s" repeatCount="indefinite" />
        )}
      </path>

      {/* ─── STOMACH / ABDOMEN ─── */}
      <path
        id="stomach"
        d="M58,160 L142,160 C140,185 138,210 130,225 L100,228 L70,225 C62,210 60,185 58,160 Z"
        fill="url(#bodyGrad)"
        stroke="url(#outlineGrad)"
        strokeWidth="0.8"
        className="somatic-zone"
        style={{
          cursor: "pointer",
          ...(getIntensity("stomach") > 0 ? { fill: "url(#glowGrad)", filter: "url(#softGlow)" } : {}),
        }}
        opacity={getIntensity("stomach") > 0 ? getIntensity("stomach") : 1}
        onClick={() => onZoneClick("stomach")}
      >
        {getIntensity("stomach") > 0 && (
          <animate attributeName="opacity" values={`${getIntensity("stomach")};${getIntensity("stomach") * 0.7};${getIntensity("stomach")}`} dur="4s" repeatCount="indefinite" />
        )}
      </path>

      {/* ─── PELVIS ─── */}
      <path
        id="pelvis"
        d="M70,225 L130,225 C132,245 130,265 125,275 L100,280 L75,275 C70,265 68,245 70,225 Z"
        fill="url(#bodyGrad)"
        stroke="url(#outlineGrad)"
        strokeWidth="0.8"
        className="somatic-zone"
        style={{
          cursor: "pointer",
          ...(getIntensity("pelvis") > 0 ? { fill: "url(#glowGrad)", filter: "url(#softGlow)" } : {}),
        }}
        opacity={getIntensity("pelvis") > 0 ? getIntensity("pelvis") : 1}
        onClick={() => onZoneClick("pelvis")}
      >
        {getIntensity("pelvis") > 0 && (
          <animate attributeName="opacity" values={`${getIntensity("pelvis")};${getIntensity("pelvis") * 0.7};${getIntensity("pelvis")}`} dur="4s" repeatCount="indefinite" />
        )}
      </path>

      {/* ─── ARMS (left + right as one group) ─── */}
      <g
        id="arms"
        className="somatic-zone"
        style={{
          cursor: "pointer",
          ...(getIntensity("arms") > 0 ? { filter: "url(#softGlow)" } : {}),
        }}
        onClick={() => onZoneClick("arms")}
      >
        {/* Left arm */}
        <path
          d="M55,110 L42,108 C35,112 28,130 22,160 C18,178 16,195 20,200 C24,204 28,200 30,192 L45,145 L52,140 L58,160"
          fill={getIntensity("arms") > 0 ? "url(#glowGrad)" : "url(#bodyGrad)"}
          stroke="url(#outlineGrad)"
          strokeWidth="0.8"
          opacity={getIntensity("arms") > 0 ? getIntensity("arms") : 1}
        >
          {getIntensity("arms") > 0 && (
            <animate attributeName="opacity" values={`${getIntensity("arms")};${getIntensity("arms") * 0.7};${getIntensity("arms")}`} dur="4s" repeatCount="indefinite" />
          )}
        </path>
        {/* Right arm */}
        <path
          d="M145,110 L158,108 C165,112 172,130 178,160 C182,178 184,195 180,200 C176,204 172,200 170,192 L155,145 L148,140 L142,160"
          fill={getIntensity("arms") > 0 ? "url(#glowGrad)" : "url(#bodyGrad)"}
          stroke="url(#outlineGrad)"
          strokeWidth="0.8"
          opacity={getIntensity("arms") > 0 ? getIntensity("arms") : 1}
        >
          {getIntensity("arms") > 0 && (
            <animate attributeName="opacity" values={`${getIntensity("arms")};${getIntensity("arms") * 0.7};${getIntensity("arms")}`} dur="4s" repeatCount="indefinite" />
          )}
        </path>
      </g>

      {/* ─── LEGS (left + right as one group) ─── */}
      <g
        id="legs"
        className="somatic-zone"
        style={{
          cursor: "pointer",
          ...(getIntensity("legs") > 0 ? { filter: "url(#softGlow)" } : {}),
        }}
        onClick={() => onZoneClick("legs")}
      >
        {/* Left leg */}
        <path
          d="M75,275 L100,280 L95,330 L90,380 L85,430 L80,460 C78,470 72,475 70,472 C68,468 70,460 72,450 L78,400 L80,350 L78,310 L70,280"
          fill={getIntensity("legs") > 0 ? "url(#glowGrad)" : "url(#bodyGrad)"}
          stroke="url(#outlineGrad)"
          strokeWidth="0.8"
          opacity={getIntensity("legs") > 0 ? getIntensity("legs") : 1}
        >
          {getIntensity("legs") > 0 && (
            <animate attributeName="opacity" values={`${getIntensity("legs")};${getIntensity("legs") * 0.7};${getIntensity("legs")}`} dur="4s" repeatCount="indefinite" />
          )}
        </path>
        {/* Right leg */}
        <path
          d="M125,275 L100,280 L105,330 L110,380 L115,430 L120,460 C122,470 128,475 130,472 C132,468 130,460 128,450 L122,400 L120,350 L122,310 L130,280"
          fill={getIntensity("legs") > 0 ? "url(#glowGrad)" : "url(#bodyGrad)"}
          stroke="url(#outlineGrad)"
          strokeWidth="0.8"
          opacity={getIntensity("legs") > 0 ? getIntensity("legs") : 1}
        >
          {getIntensity("legs") > 0 && (
            <animate attributeName="opacity" values={`${getIntensity("legs")};${getIntensity("legs") * 0.7};${getIntensity("legs")}`} dur="4s" repeatCount="indefinite" />
          )}
        </path>
      </g>
    </svg>
  );
}

/* ─── Main Component ─── */
export function SomaticMap({ entries, periodLabel }: SomaticMapProps) {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const { zoneCounts, hasData } = useMemo(() => {
    const zoneCounts = parseZoneFrequencies(entries);
    const hasData = Object.keys(zoneCounts).length > 0;
    return { zoneCounts, hasData };
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

  const handleZoneClick = (zone: string) => {
    setSelectedZone(zone === selectedZone ? null : zone);
  };

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

      {/* SVG Body */}
      <div className="relative flex justify-center py-4">
        <BodySVG activeZones={zoneCounts} onZoneClick={handleZoneClick} />
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
