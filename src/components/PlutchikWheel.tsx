import { motion } from "framer-motion";

/**
 * Колесо эмоций Плутчика — 8 секторов × 3 кольца интенсивности.
 * Внутреннее кольцо = сильная эмоция (intensity 3),
 * среднее = базовая (2), внешнее = слабая (1).
 */

export interface PlutchikEmotion {
  /** Название для сохранения / отображения (рус). */
  name: string;
  /** Интенсивность 1 (слабая) — 3 (сильная). */
  intensity: number;
  /** Базовый HSL цвет сектора. */
  color: string;
  /** Английский ключ сектора (joy, trust...). */
  sector: string;
}

interface Sector {
  key: string;
  /** [strong, base, mild] — от центра к краю. */
  labels: [string, string, string];
  /** Базовый цвет сектора в HSL. */
  hue: number;
  saturation: number;
}

const SECTORS: Sector[] = [
  { key: "joy",          labels: ["Восторг",      "Радость",      "Безмятежность"], hue: 48,  saturation: 92 },
  { key: "trust",        labels: ["Восхищение",   "Доверие",      "Принятие"],      hue: 90,  saturation: 55 },
  { key: "fear",         labels: ["Ужас",         "Страх",        "Опасение"],      hue: 145, saturation: 50 },
  { key: "surprise",     labels: ["Изумление",    "Удивление",    "Отвлечение"],    hue: 185, saturation: 70 },
  { key: "sadness",      labels: ["Горе",         "Грусть",       "Задумчивость"],  hue: 220, saturation: 70 },
  { key: "disgust",      labels: ["Омерзение",    "Отвращение",   "Скука"],         hue: 280, saturation: 55 },
  { key: "anger",        labels: ["Ярость",       "Гнев",         "Досада"],        hue: 0,   saturation: 80 },
  { key: "anticipation", labels: ["Бдительность", "Предвкушение", "Интерес"],       hue: 28,  saturation: 92 },
];

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS_INNER_HOLE = 32;
const RADIUS_RING_1 = 72;   // strong (intensity 3)
const RADIUS_RING_2 = 116;  // base   (intensity 2)
const RADIUS_RING_3 = 156;  // mild   (intensity 1)

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function annularSector(cx: number, cy: number, rInner: number, rOuter: number, startA: number, endA: number) {
  const p1 = polar(cx, cy, rOuter, startA);
  const p2 = polar(cx, cy, rOuter, endA);
  const p3 = polar(cx, cy, rInner, endA);
  const p4 = polar(cx, cy, rInner, startA);
  const largeArc = endA - startA <= 180 ? 0 : 1;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

interface PlutchikWheelProps {
  value: PlutchikEmotion | null;
  onChange: (emotion: PlutchikEmotion) => void;
}

export function PlutchikWheel({ value, onChange }: PlutchikWheelProps) {
  const sectorAngle = 360 / SECTORS.length;
  // intensity index (0 = innermost ring = strongest), aligns with labels array
  const rings: Array<{ rInner: number; rOuter: number; intensity: number; lightness: number; alpha: number }> = [
    { rInner: RADIUS_INNER_HOLE, rOuter: RADIUS_RING_1, intensity: 3, lightness: 50, alpha: 0.55 },
    { rInner: RADIUS_RING_1,    rOuter: RADIUS_RING_2, intensity: 2, lightness: 62, alpha: 0.42 },
    { rInner: RADIUS_RING_2,    rOuter: RADIUS_RING_3, intensity: 1, lightness: 75, alpha: 0.30 },
  ];

  return (
    <div className="flex flex-col items-center gap-5 select-none">
      <div className="relative" style={{ width: "min(100%, 360px)" }}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-full h-auto drop-shadow-[0_8px_30px_rgba(168,139,250,0.18)]"
        >
          <defs>
            <radialGradient id="wheelGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(0 0% 100% / 0.35)" />
              <stop offset="100%" stopColor="hsl(0 0% 100% / 0)" />
            </radialGradient>
            <filter id="petalBlur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.5" />
            </filter>
          </defs>

          {/* outer soft halo */}
          <circle cx={CENTER} cy={CENTER} r={RADIUS_RING_3 + 4} fill="url(#wheelGlow)" />

          {SECTORS.map((sector, sIdx) => {
            const startA = sIdx * sectorAngle - sectorAngle / 2;
            const endA = startA + sectorAngle;

            return rings.map((ring, rIdx) => {
              const isSelected =
                value?.sector === sector.key && value?.intensity === ring.intensity;
              const fill = `hsl(${sector.hue} ${sector.saturation}% ${ring.lightness}% / ${
                isSelected ? Math.min(ring.alpha + 0.35, 0.92) : ring.alpha
              })`;
              const stroke = isSelected
                ? `hsl(${sector.hue} ${sector.saturation}% ${ring.lightness}% / 0.95)`
                : "hsl(0 0% 100% / 0.35)";

              return (
                <motion.path
                  key={`${sector.key}-${ring.intensity}`}
                  d={annularSector(CENTER, CENTER, ring.rInner, ring.rOuter, startA, endA)}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isSelected ? 1.4 : 0.6}
                  filter="url(#petalBlur)"
                  style={{
                    cursor: "pointer",
                    transformOrigin: `${CENTER}px ${CENTER}px`,
                    filter: isSelected
                      ? `drop-shadow(0 0 14px hsl(${sector.hue} ${sector.saturation}% ${ring.lightness}% / 0.85)) drop-shadow(0 0 6px hsl(${sector.hue} ${sector.saturation}% 70% / 0.6))`
                      : undefined,
                  }}
                  whileHover={{ scale: 1.015, opacity: 1 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(10);
                    // labels indexed 0 = strong (intensity 3), 1 = base (2), 2 = mild (1)
                    const labelIdx = 3 - ring.intensity;
                    onChange({
                      name: sector.labels[labelIdx],
                      intensity: ring.intensity,
                      color: `hsl(${sector.hue} ${sector.saturation}% ${ring.lightness}%)`,
                      sector: sector.key,
                    });
                  }}
                />
              );
            });
          })}

          {/* central glass disc */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS_INNER_HOLE}
            fill="hsl(0 0% 100% / 0.55)"
            stroke="hsl(0 0% 100% / 0.6)"
            strokeWidth={1}
            style={{ filter: "drop-shadow(0 2px 12px hsl(263 60% 60% / 0.25))" }}
          />
          {value && (
            <text
              x={CENTER}
              y={CENTER + 4}
              textAnchor="middle"
              fontSize={11}
              fontFamily="'Playfair Display', 'Cormorant Garamond', serif"
              fontStyle="italic"
              fill={value.color}
              opacity={0.95}
            >
              ✦
            </text>
          )}
        </svg>
      </div>

      <div className="text-center min-h-[44px]">
        {value ? (
          <motion.div
            key={`${value.sector}-${value.intensity}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <p
              className="font-serif italic text-2xl tracking-wide"
              style={{ color: value.color, textShadow: `0 0 18px ${value.color}55` }}
            >
              {value.name}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
              {value.intensity === 3 ? "Сильно" : value.intensity === 2 ? "Умеренно" : "Едва уловимо"}
            </p>
          </motion.div>
        ) : (
          <p className="font-serif italic text-sm text-muted-foreground/70">
            Коснись лепестка, который откликается
          </p>
        )}
      </div>
    </div>
  );
}
