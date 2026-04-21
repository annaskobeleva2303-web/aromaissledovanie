import { motion } from "framer-motion";

/**
 * Колесо Живых Смыслов — авторская переработка колеса Плутчика.
 * 8 секторов × 3 кольца интенсивности.
 * Внешнее кольцо (labels[0]) = слабая (intensity 1)
 * Среднее   (labels[1]) = базовая (intensity 2) — здесь пишем подпись
 * Внутреннее (labels[2]) = сильная (intensity 3)
 */

export interface PlutchikEmotion {
  name: string;
  intensity: number;
  color: string;
  sector: string;
}

interface Sector {
  key: string;
  /** [weak, base, strong] — labels[0]=внешнее, labels[1]=среднее, labels[2]=внутреннее */
  labels: [string, string, string];
  hue: number;
  saturation: number;
}

const SECTORS: Sector[] = [
  // РЕСУРСНЫЕ
  { key: "energy",        hue: 45,  saturation: 90, labels: ["Энергичность",   "Наполненность",     "Эйфория"] },
  { key: "clarity",       hue: 140, saturation: 70, labels: ["Присутствие",    "Сосредоточенность", "Поточность"] },
  { key: "calm",          hue: 200, saturation: 80, labels: ["Расслабленность","Гармония",          "Тишина"] },
  { key: "expression",    hue: 340, saturation: 85, labels: ["Смелость",       "Активность",        "Привлекательность"] },
  // ДЕФИЦИТНЫЕ
  { key: "anxiety",       hue: 20,  saturation: 90, labels: ["Беспокойство",   "Суета",             "Паника"] },
  { key: "tension",       hue: 0,   saturation: 90, labels: ["Скованность",    "Гиперконтроль",     "Зажим"] },
  { key: "fatigue",       hue: 260, saturation: 70, labels: ["Апатия",         "Истощение",         "Выгорание"] },
  { key: "vulnerability", hue: 230, saturation: 80, labels: ["Растерянность",  "Хрупкость",         "Оголенность"] },
];

const SIZE = 360;
const CENTER = SIZE / 2;
const RADIUS_INNER_HOLE = 36;
const RADIUS_RING_1 = 84;   // strong (intensity 3) — внутреннее
const RADIUS_RING_2 = 132;  // base   (intensity 2) — среднее
const RADIUS_RING_3 = 176;  // weak   (intensity 1) — внешнее
const LABEL_RADIUS = (RADIUS_RING_1 + RADIUS_RING_2) / 2;

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

/** Дуга для textPath — слева направо (читаемо сверху и снизу). */
function labelArcPath(cx: number, cy: number, r: number, startA: number, endA: number) {
  const midA = (startA + endA) / 2;
  // Если дуга в нижней половине круга (midA между 90 и 270), переворачиваем для читаемости
  const flip = midA > 90 && midA < 270;
  const a1 = flip ? endA : startA;
  const a2 = flip ? startA : endA;
  const p1 = polar(cx, cy, r, a1);
  const p2 = polar(cx, cy, r, a2);
  const sweep = flip ? 0 : 1;
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 ${sweep} ${p2.x} ${p2.y}`;
}

interface PlutchikWheelProps {
  value: PlutchikEmotion | null;
  onChange: (emotion: PlutchikEmotion) => void;
}

export function PlutchikWheel({ value, onChange }: PlutchikWheelProps) {
  const sectorAngle = 360 / SECTORS.length;
  // intensity 3 = inner ring, intensity 1 = outer ring
  const rings: Array<{ rInner: number; rOuter: number; intensity: number; lightness: number; alpha: number }> = [
    { rInner: RADIUS_INNER_HOLE, rOuter: RADIUS_RING_1, intensity: 3, lightness: 50, alpha: 0.58 },
    { rInner: RADIUS_RING_1,    rOuter: RADIUS_RING_2, intensity: 2, lightness: 62, alpha: 0.42 },
    { rInner: RADIUS_RING_2,    rOuter: RADIUS_RING_3, intensity: 1, lightness: 76, alpha: 0.30 },
  ];

  const labelFromIntensity = (sector: Sector, intensity: number) => {
    // intensity 1 → labels[0], 2 → labels[1], 3 → labels[2]
    return sector.labels[intensity - 1];
  };

  return (
    <div className="flex flex-col items-center gap-5 select-none">
      <div className="relative w-full" style={{ maxWidth: 400 }}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-full h-auto drop-shadow-[0_8px_30px_rgba(168,139,250,0.18)]"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <defs>
            <radialGradient id="wheelGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(0 0% 100% / 0.35)" />
              <stop offset="100%" stopColor="hsl(0 0% 100% / 0)" />
            </radialGradient>
            <filter id="petalBlur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.4" />
            </filter>
            {SECTORS.map((sector, sIdx) => {
              const startA = sIdx * sectorAngle - sectorAngle / 2;
              const endA = startA + sectorAngle;
              return (
                <path
                  key={`arc-${sector.key}`}
                  id={`label-arc-${sector.key}`}
                  d={labelArcPath(CENTER, CENTER, LABEL_RADIUS, startA, endA)}
                  fill="none"
                />
              );
            })}
          </defs>

          <circle cx={CENTER} cy={CENTER} r={RADIUS_RING_3 + 4} fill="url(#wheelGlow)" />

          {/* Petals */}
          {SECTORS.map((sector, sIdx) => {
            const startA = sIdx * sectorAngle - sectorAngle / 2;
            const endA = startA + sectorAngle;

            return rings.map((ring) => {
              const isSelected =
                value?.sector === sector.key && value?.intensity === ring.intensity;
              const fill = `hsl(${sector.hue} ${sector.saturation}% ${ring.lightness}% / ${
                isSelected ? Math.min(ring.alpha + 0.38, 0.94) : ring.alpha
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
                  strokeWidth={isSelected ? 1.6 : 0.6}
                  className="focus:outline-none"
                  style={{
                    cursor: "pointer",
                    transformOrigin: `${CENTER}px ${CENTER}px`,
                    WebkitTapHighlightColor: "transparent",
                    outline: "none",
                    filter: isSelected
                      ? `drop-shadow(0 0 16px hsl(${sector.hue} ${sector.saturation}% ${ring.lightness}% / 0.9)) drop-shadow(0 0 8px hsl(${sector.hue} ${sector.saturation}% 70% / 0.65))`
                      : "url(#petalBlur)",
                  }}
                  whileHover={{ scale: 1.012, opacity: 1 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  tabIndex={-1}
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(10);
                    onChange({
                      name: labelFromIntensity(sector, ring.intensity),
                      intensity: ring.intensity,
                      color: `hsl(${sector.hue} ${sector.saturation}% ${ring.lightness}%)`,
                      sector: sector.key,
                    });
                  }}
                />
              );
            });
          })}

          {/* Labels on middle ring */}
          {SECTORS.map((sector) => (
            <text
              key={`text-${sector.key}`}
              fontSize={9.5}
              fontFamily="'Playfair Display', 'Cormorant Garamond', serif"
              fontStyle="italic"
              fill="hsl(270 45% 16%)"
              opacity={0.82}
              style={{ pointerEvents: "none", letterSpacing: "0.06em" }}
            >
              <textPath
                href={`#label-arc-${sector.key}`}
                startOffset="50%"
                textAnchor="middle"
              >
                {sector.labels[1]}
              </textPath>
            </text>
          ))}

          {/* Central glass disc */}
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
              y={CENTER + 5}
              textAnchor="middle"
              fontSize={14}
              fontFamily="'Playfair Display', serif"
              fontStyle="italic"
              fill={value.color}
              opacity={0.95}
            >
              ✦
            </text>
          )}
        </svg>
      </div>

      <div className="text-center min-h-[52px]">
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
