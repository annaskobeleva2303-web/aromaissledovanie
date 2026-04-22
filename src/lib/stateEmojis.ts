// Mapping of new emotional state names → emoji glyphs.
// Used by Calendar, Session detail card and ShareCard.

export const STATE_EMOJIS: Record<string, string> = {
  // Дефицит / Низкая энергия
  "Усталость": "🥱",
  "Апатия": "🫠",
  "Тревожность": "😰",
  "Раздражение": "😤",
  "Грусть": "😔",
  "Опустошенность": "🪫",
  // Баланс / Нейтральный спектр
  "Спокойствие": "😌",
  "Умиротворение": "🕊️",
  "Присутствие в теле": "🪴",
  "Расслабленность": "☁️",
  "Любопытство": "👀",
  // Ресурс / Высокая энергия
  "Бодрость": "⚡",
  "Вдохновение": "✨",
  "Радость": "☀️",
  "Уверенность": "👑",
  "Чувственность": "🌹",
  "Ясность": "💎",
  "Открытость": "🌸",
};

// Legacy keys (old MOODS dictionary) kept for backwards compatibility
// with entries saved before the chips redesign.
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

export const getEmojiForState = (
  stateData: string | string[] | null | undefined,
): string => {
  if (!stateData) return "✨";

  let firstState = "";
  if (Array.isArray(stateData)) {
    firstState = stateData[0] ?? "";
  } else {
    // Could arrive as a JSON-encoded array or a comma-separated string
    const trimmed = stateData.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) firstState = parsed[0] ?? "";
        else firstState = String(parsed);
      } catch {
        firstState = trimmed.replace(/[\[\]"']/g, "").split(",")[0].trim();
      }
    } else {
      firstState = trimmed.split(",")[0].replace(/["']/g, "").trim();
    }
  }

  if (!firstState) return "✨";
  return STATE_EMOJIS[firstState] || LEGACY_EMOJIS[firstState] || "✨";
};
