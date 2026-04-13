import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User } from "lucide-react";
import { BODY_ZONES } from "@/components/BodyZoneChips";
import somaticBody from "@/assets/somatic-body.png";

const ZONE_META: Record<string, { label: string; description: string }> = {
  head: { label: "Голова", description: "Зона ясности, мыслей и связи с высшим" },
  throat: { label: "Горло и шея", description: "Зона самовыражения и правды" },
  chest: { label: "Грудь и сердце", description: "Зона чувств, любви и принятия" },
  stomach: { label: "Живот", description: "Зона силы, интуиции и внутреннего огня" },
  pelvis: { label: "Таз и основание", description: "Зона заземления, корней и витальной энергии" },
  arms: { label: "Руки", description: "Зона действия, контакта и творчества" },
  legs: { label: "Ноги", description: "Зона движения, опоры и заземления" },
};

const ZONE_KEYWORDS: Record<string, string[]> = {
  head: ["голова", "виски", "лоб", "мозг", "затылок", "макушка", "темя", "череп"],
  throat: ["горло", "шея", "голос", "кадык", "связки", "гортань"],
  chest: ["грудь", "сердце", "дыхание", "рёбра", "ребра", "лопатки", "лёгкие", "легкие", "грудная"],
  stomach: ["живот", "солнечное сплетение", "желудок", "пресс", "диафрагма", "пупок"],
  pelvis: ["таз", "матка", "низ живота", "крестец", "копчик", "бёдра", "бедра", "пах"],
  arms: ["руки", "ладони", "плечи", "пальцы", "запястья", "локти", "кисти"],
  legs: ["ноги", "стопы", "колени", "голени", "ступни"],
};

// Strict percentage coordinates for glow orbs over the 3D model image
const ZONE_POSITIONS: Record<string, Array<{ top: string; left: string }>> = {
  head:    [{ top: "14%", left: "50%" }],
  throat:  [{ top: "23%", left: "50%" }],
  chest:   [{ top: "34%", left: "50%" }],
  stomach: [{ top: "43%", left: "50%" }],
  pelvis:  [{ top: "51%", left: "50%" }],
  arms:    [{ top: "52%", left: "23%" }, { top: "52%", left: "77%" }],
  legs:    [{ top: "72%", left: "42%" }, { top: "72%", left: "58%" }],
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
      // fallback to keyword matching
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

  const maxCount = Math.max(...Object.values(zoneCounts), 1);
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

      {/* 3D Model + Glow Orbs */}
      <div className="relative w-full max-w-[250px] mx-auto aspect-[1/2]">
        <img
          src={somaticBody}
          alt="Силуэт тела"
          className="w-full h-full object-contain pointer-events-none select-none"
          draggable={false}
        />

        {/* Render glow orbs for active zones */}
        {Object.entries(zoneCounts).map(([zone, count]) => {
          const positions = ZONE_POSITIONS[zone];
          if (!positions) return null;
          const intensity = 0.4 + (count / maxCount) * 0.6;

          return positions.map((pos, i) => (
            <div
              key={`${zone}-${i}`}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
              style={{ top: pos.top, left: pos.left }}
              onClick={() => handleZoneClick(zone)}
            >
              {/* Outer soft glow */}
              <div
                className="w-16 h-16 rounded-full animate-pulse"
                style={{
                  background: `radial-gradient(circle, hsla(35,95%,65%,${intensity * 0.7}) 0%, hsla(300,60%,58%,${intensity * 0.3}) 50%, transparent 100%)`,
                  filter: "blur(12px)",
                  mixBlendMode: "screen",
                }}
              />
              {/* Inner bright core */}
              <div
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full animate-pulse"
                style={{
                  background: `radial-gradient(circle, hsla(35,95%,75%,${intensity * 0.9}) 0%, hsla(300,60%,60%,${intensity * 0.4}) 70%, transparent 100%)`,
                  filter: "blur(4px)",
                  mixBlendMode: "screen",
                }}
              />
            </div>
          ));
        })}
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
              {ZONE_META[selectedZone].label}
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
