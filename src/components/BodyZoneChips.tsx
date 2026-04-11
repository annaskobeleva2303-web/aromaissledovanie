import { motion } from "framer-motion";

export const BODY_ZONES = [
  { id: "head", label: "Голова", emoji: "🧠" },
  { id: "throat", label: "Горло/Шея", emoji: "🗣️" },
  { id: "chest", label: "Грудь/Сердце", emoji: "💗" },
  { id: "stomach", label: "Живот/Сплетенье", emoji: "🔥" },
  { id: "pelvis", label: "Таз/Низ живота", emoji: "🌿" },
  { id: "arms", label: "Руки", emoji: "🤲" },
  { id: "legs", label: "Ноги", emoji: "🦶" },
] as const;

interface BodyZoneChipsProps {
  selected: string[];
  onChange: (zones: string[]) => void;
}

export function BodyZoneChips({ selected, onChange }: BodyZoneChipsProps) {
  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((z) => z !== id)
        : [...selected, id]
    );
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground/80">🫶 Где в теле ощущается масло?</label>
      <p className="text-xs text-muted-foreground/60">Выберите одну или несколько зон</p>
      <div className="flex flex-wrap gap-2">
        {BODY_ZONES.map((zone) => {
          const isSelected = selected.includes(zone.id);
          return (
            <motion.button
              key={zone.id}
              type="button"
              onClick={() => toggle(zone.id)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm backdrop-blur-sm transition-all duration-300 ${
                isSelected
                  ? "bg-[rgba(255,210,120,0.13)] text-foreground border-transparent shadow-[0_0_20px_6px_rgba(255,180,80,0.30),0_0_40px_10px_rgba(255,160,60,0.12)]"
                  : "bg-white/40 text-foreground/70 border border-white/20 hover:bg-white/60 hover:shadow-sm"
              }`}
            >
              <span className="text-base">{zone.emoji}</span>
              <span>{zone.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
