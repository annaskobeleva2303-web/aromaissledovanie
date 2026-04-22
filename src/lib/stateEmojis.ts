// Re-export from the centralized utility (single source of truth).
export {
  EMOTIONAL_STATE_MAP,
  getEmojiForStateName,
  getEmojiForMoods,
  parseMoodField,
  getEmojiForState,
} from "@/utils/stateUtils";

// Backwards-compatible flat lookup map.
import { EMOTIONAL_STATE_MAP } from "@/utils/stateUtils";
export const STATE_EMOJIS: Record<string, string> = Object.fromEntries(
  EMOTIONAL_STATE_MAP.map((s) => [s.name, s.emoji]),
);
