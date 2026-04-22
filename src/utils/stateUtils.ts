// Centralized dictionary of emotional states → emoji + category.
// Single source of truth for chips, calendar, session details and share card.

export type EmotionalState = {
  name: string;
  emoji: string;
  category: "Дефицит" | "Баланс" | "Ресурс";
};

export const EMOTIONAL_STATE_MAP: EmotionalState[] = [
  // ДЕФИЦИТ
  { name: "Усталость", emoji: "🥱", category: "Дефицит" },
  { name: "Апатия", emoji: "🫠", category: "Дефицит" },
  { name: "Тревожность", emoji: "😰", category: "Дефицит" },
  { name: "Раздражение", emoji: "😤", category: "Дефицит" },
  { name: "Грусть", emoji: "😔", category: "Дефицит" },
  { name: "Опустошенность", emoji: "🪫", category: "Дефицит" },
  // БАЛАНС
  { name: "Спокойствие", emoji: "😌", category: "Баланс" },
  { name: "Умиротворение", emoji: "🕊️", category: "Баланс" },
  { name: "Присутствие в теле", emoji: "🪴", category: "Баланс" },
  { name: "Расслабленность", emoji: "☁️", category: "Баланс" },
  { name: "Любопытство", emoji: "👀", category: "Баланс" },
  // РЕСУРС
  { name: "Бодрость", emoji: "⚡", category: "Ресурс" },
  { name: "Вдохновение", emoji: "✨", category: "Ресурс" },
  { name: "Радость", emoji: "☀️", category: "Ресурс" },
  { name: "Уверенность", emoji: "👑", category: "Ресурс" },
  { name: "Чувственность", emoji: "🌹", category: "Ресурс" },
  { name: "Ясность", emoji: "💎", category: "Ресурс" },
  { name: "Открытость", emoji: "🌸", category: "Ресурс" },
];

// Legacy keys for entries saved before chips redesign.
const LEGACY_EMOJIS: Record<string, string> = {
  calm: "😌",
  anxious: "😰",
  joyful: "☀️",
  sad: "😔",
  energetic: "⚡",
  irritated: "😤",
  reflective: "🤔",
  grateful: "🙏",
};

export const getEmojiForStateName = (name: string): string => {
  if (!name) return "✨";
  const found = EMOTIONAL_STATE_MAP.find((s) => s.name === name);
  if (found) return found.emoji;
  return LEGACY_EMOJIS[name] || "✨";
};

export const getEmojiForMoods = (
  moods: string[] | null | undefined,
): string => {
  if (!moods || moods.length === 0) return "✨";
  return getEmojiForStateName(moods[0]);
};

// Parse a mood field that may arrive as a JSON-encoded array,
// a comma-separated string, or a single state name.
export const parseMoodField = (
  data: string | string[] | null | undefined,
): string[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter(Boolean);
  const trimmed = data.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
      return [String(parsed)];
    } catch {
      return trimmed
        .replace(/[\[\]"']/g, "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return trimmed
    .split(",")
    .map((s) => s.replace(/["']/g, "").trim())
    .filter(Boolean);
};

// Convenience: parse arbitrary mood data and return its emoji.
export const getEmojiForState = (
  data: string | string[] | null | undefined,
): string => {
  const moods = parseMoodField(data);
  return getEmojiForMoods(moods);
};
