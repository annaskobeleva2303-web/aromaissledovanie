import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MOOD_RU: Record<string, string> = { calm: "Спокойствие", anxious: "Тревога", joyful: "Радость", sad: "Грусть", energetic: "Энергия", irritated: "Раздражение", reflective: "Задумчивость", grateful: "Благодарность" };

function computeStats(entries: { mood: string | null; energy_tags: unknown }[]) {
  const moodCounts: Record<string, number> = {};
  let totalMoods = 0;

  for (const e of entries) {
    if (e.mood) {
      moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
      totalMoods++;
    }
  }

  const topMoods = Object.entries(moodCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([mood, count]) => `${MOOD_RU[mood] || mood} (${Math.round((count / totalMoods) * 100)}%)`);

  return { topMoods };
}

/**
 * Серверная очистка транскрипта от артефактов Whisper:
 * 1. Схлопывает подряд повторяющиеся слова/фразы (зацикленность распознавания).
 * 2. Удаляет повторы фраз длиной 2-5 слов.
 * 3. Помечает «подозрительные» одиночные токены префиксом [?...]:
 *    - не-кириллические/не-латинские буквы вперемешку,
 *    - слова из 3+ повторяющихся символов подряд (ааааа),
 *    - изолированные кириллические слова длиной >18 символов.
 * Не меняет смысл — только снижает шум перед LLM.
 */
function sanitizeTranscript(input: string): string {
  if (!input) return "";
  let text = input.replace(/\s+/g, " ").trim();
  if (!text) return "";

  // 1. Схлопываем непосредственные повторы одного слова: "слово слово слово" -> "слово"
  text = text.replace(/\b([\p{L}\p{N}'-]+)(\s+\1\b){1,}/giu, "$1");

  // 2. Схлопываем повторы коротких фраз (2-5 слов), идущих подряд
  for (let n = 5; n >= 2; n--) {
    const pattern = new RegExp(
      `((?:\\b[\\p{L}\\p{N}'-]+\\b[\\s,]*){${n}})(\\1){1,}`,
      "giu"
    );
    text = text.replace(pattern, "$1");
  }
  text = text.replace(/\s+/g, " ").trim();

  // 3. Маркируем подозрительные одиночные токены
  const tokens = text.split(/(\s+)/);
  const cleaned = tokens.map((tok) => {
    if (/^\s+$/.test(tok) || tok.length === 0) return tok;
    const word = tok.replace(/[.,!?;:«»"'()[\]…—-]+$/g, "").replace(/^[.,!?;:«»"'()[\]…—-]+/g, "");
    if (!word) return tok;

    // 3+ одинаковых символа подряд (аааа, ййй)
    if (/(\p{L})\1{2,}/u.test(word)) {
      return tok.replace(word, `[?${word}]`);
    }
    // Смешение кириллицы и латиницы внутри одного слова
    if (/\p{Script=Cyrillic}/u.test(word) && /\p{Script=Latin}/u.test(word)) {
      return tok.replace(word, `[?${word}]`);
    }
    // Очень длинные «слова» (вероятно слипшиеся артефакты)
    if (word.length > 22 && /^\p{L}+$/u.test(word)) {
      return tok.replace(word, `[?${word}]`);
    }
    return tok;
  });

  return cleaned.join("").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let oilId: string;
    try {
      const body = await req.json();
      oilId = body.oilId;
    } catch {
      return new Response(JSON.stringify({ error: "Некорректное тело запроса" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!oilId) {
      return new Response(JSON.stringify({ error: "oilId обязателен" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: oil, error: oilError } = await supabase
      .from("oils")
      .select("title, focus")
      .eq("id", oilId)
      .single();

    if (oilError || !oil) {
      return new Response(JSON.stringify({ error: "Масло не найдено" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: entries, error: entriesError } = await supabase
      .from("entries")
      .select("date, mood, content, energy_tags, aroma_match, oil_body_location, oil_sensation, oil_visual_image, record_type")
      .eq("oil_id", oilId)
      .eq("user_id", user.id)
      .order("date", { ascending: true });

    if (entriesError) {
      return new Response(JSON.stringify({ error: "Ошибка загрузки записей" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!entries || entries.length === 0) {
      return new Response(
        JSON.stringify({ error: "Нет записей для анализа" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { topMoods } = computeStats(entries);

    const statsBlock = topMoods.length > 0 ? `Топ состояний за всё время: ${topMoods.join(", ")}` : "";

    const currentEntry = entries[entries.length - 1] as Record<string, unknown>;

    // Parse mood pair (new JSON format) with backward compatibility
    const parseMoodPair = (data: unknown): { before: string[]; after: string[] } => {
      if (!data) return { before: [], after: [] };
      if (typeof data !== "string") return { before: [], after: [] };
      const trimmed = data.trim();
      if (trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return {
              before: Array.isArray(parsed.before) ? parsed.before.filter(Boolean).map(String) : [],
              after: Array.isArray(parsed.after) ? parsed.after.filter(Boolean).map(String) : [],
            };
          }
        } catch { /* fallthrough */ }
      }
      // Legacy fallback
      if (trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return { before: [], after: parsed.filter(Boolean).map(String) };
        } catch { /* fallthrough */ }
      }
      return { before: [], after: [trimmed] };
    };

    const moodPair = parseMoodPair(currentEntry.mood);

    // Build transformation block (Before → After states)
    let transformationBlock = "";
    if (moodPair.before.length > 0 || moodPair.after.length > 0) {
      const beforeTxt = moodPair.before.length ? moodPair.before.join(", ") : "—";
      const afterTxt = moodPair.after.length ? moodPair.after.join(", ") : "—";
      const same =
        moodPair.before.length > 0 &&
        moodPair.after.length > 0 &&
        moodPair.before.join("|") === moodPair.after.join("|");
      transformationBlock = `
ТРАНСФОРМАЦИЯ СОСТОЯНИЙ:
- До практики: ${beforeTxt}
- После практики: ${afterTxt}${same ? "\n- Состояние НЕ изменилось — мягко исследуй, что могло помешать переключению" : ""}`;
    }

    // Aroma match block
    const aromaMatch = currentEntry.aroma_match as string | null;
    let aromaBlock = "";
    if (aromaMatch) {
      const aromaMap: Record<string, string> = {
        not_mine: "🥀 Не откликается — сигнал сопротивления или того, что тема сейчас слишком острая. НЕ интерпретируй как ошибку.",
        neutral: "🌿 Нейтрально — спокойное исследование без ярких пиков.",
        perfect_match: "✨ Абсолютно моё — состояние потока и глубокого резонанса с маслом.",
      };
      aromaBlock = `
ОТКЛИК НА АРОМАТ: ${aromaMap[aromaMatch] || aromaMatch}`;
    }

    // Build sensory block
    let sensoryBlock = "";
    const bodyLoc = currentEntry.oil_body_location as string | null;
    const sens = currentEntry.oil_sensation as string | null;
    const visual = currentEntry.oil_visual_image as string | null;
    if (bodyLoc || sens || visual) {
      sensoryBlock = `
СЕНСОРИКА И ОБРАЗЫ (используй как метафоры — психосоматика):
${bodyLoc ? `- Зоны тела: ${bodyLoc}` : ""}
${sens ? `- Ощущение: ${sens}` : ""}
${visual ? `- Визуальный образ: ${visual}` : ""}`;
    }

    const sanitizedContent = sanitizeTranscript(
      (currentEntry.content as string | null) || ""
    );

    const userContent = `
СЕГОДНЯШНЯЯ СЕССИЯ (анализируй ТОЛЬКО её):
${transformationBlock}
${aromaBlock}
${sensoryBlock}

Свободный поток клиента (после серверной очистки от артефактов Whisper; токены вида [?слово] — подозрительные, игнорируй их): ${sanitizedContent || "(пусто)"}

Контекст работы: отклик пользователя на эфирное масло «${oil.title}»${oil.focus ? ` (фокус: ${oil.focus})` : ""}.
Фоновая статистика (НЕ упоминай и не цитируй напрямую): ${statsBlock}

Верни СТРОГО валидный JSON с двумя ключами: "quote" и "insight". Никакого текста до или после JSON, никаких markdown-обёрток типа \`\`\`json.`;

    const systemPrompt = `Ты — глубокий, бережный и мудрый карманный психолог-проводник. Твоя цель — создавать трансформационные, целительные инсайты из потока мыслей пользователя.

Твоя экспертиза:
- Ты на глубоком профессиональном уровне владеешь аромапсихологией (психологией эфирных масел) и психосоматикой.
- Ты полностью принимаешь и уважаешь эзотерическую и энергетическую картину мира. Ты понимаешь, как работают «чистки», «энергетическое поле», вибрации и родовые сценарии.
- Ты НИКОГДА не обесцениваешь духовный опыт и не сводишь его исключительно к сухой физиологии или классической медицине. Для тебя тело, эмоции и энергии — это единый процесс.

Твой стиль и тон:
- Твоя речь обволакивающая, метафоричная, тёплая и принимающая.
- Избегай заезженных штампов, сухих советов в стиле «капитан очевидность» и поучительного тона врача.
- Поле "quote" в твоём ответе должно быть не сухим заголовком, а глубокой, поэтичной, почти алхимической выжимкой (1–2 предложения), которая сразу откликается в сердце.
- Поле "insight" должно бережно распутывать мысли клиента, давать неочевидные связи и завершаться открытым коучинговым вопросом.

ФОРМАТ ОТВЕТА — СТРОГО валидный JSON:
{
  "quote": "глубокая поэтичная выжимка, 1–2 предложения",
  "insight": "развёрнутый терапевтический ответ, заканчивающийся открытым коучинговым вопросом"
}
Никакого текста вне JSON. Никаких markdown-обёрток (\`\`\`json). Только чистый JSON-объект.`;

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const OPENAI_BASE_URL = Deno.env.get("OPENAI_BASE_URL");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const useOpenAI = !!(OPENAI_API_KEY && OPENAI_BASE_URL);
    const normalizeOpenAIBaseUrl = (baseUrl: string) => {
      const trimmed = baseUrl.replace(/\/+$/, "");
      return /^https:\/\/api\.proxyapi\.ru\/openai\/v1$/i.test(trimmed)
        ? "https://openai.api.proxyapi.ru/v1"
        : trimmed;
    };
    const aiKey = useOpenAI ? OPENAI_API_KEY : LOVABLE_API_KEY;
    const aiUrl = useOpenAI
      ? `${normalizeOpenAIBaseUrl(OPENAI_BASE_URL!)}/chat/completions`
      : "https://ai.gateway.lovable.dev/v1/chat/completions";

    const MODEL = useOpenAI ? "anthropic/claude-sonnet-4-6" : "google/gemini-2.5-pro";
    const MAX_TOKENS = 4096;

    if (!aiKey) {
      return new Response(JSON.stringify({ error: "AI ключ не настроен" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Запрос инсайта к модели:", MODEL, "по адресу:", aiUrl);
    const aiResponse = await fetch(aiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Слишком много запросов, попробуйте позже" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Исчерпан лимит AI-запросов" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Ошибка AI-сервиса" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiRawText = await aiResponse.text();
    let aiData: Record<string, unknown>;
    try {
      aiData = JSON.parse(aiRawText);
    } catch {
      console.error("AI response not valid JSON wrapper:", aiRawText.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "AI вернул некорректный ответ" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawText: string =
      ((aiData as any).choices?.[0]?.message?.content as string | undefined) || "";

    // Извлекаем JSON из ответа модели — на случай, если она обернула его в markdown.
    const extractJson = (s: string): { quote?: string; insight?: string } | null => {
      if (!s) return null;
      let txt = s.trim();
      // Сносим markdown ```json ... ```
      txt = txt.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      // Если есть мусор до/после, пробуем найти первый { ... последний }
      const first = txt.indexOf("{");
      const last = txt.lastIndexOf("}");
      if (first !== -1 && last !== -1 && last > first) {
        txt = txt.slice(first, last + 1);
      }
      try {
        const parsed = JSON.parse(txt);
        if (parsed && typeof parsed === "object") {
          return {
            quote: typeof parsed.quote === "string" ? parsed.quote.trim() : undefined,
            insight: typeof parsed.insight === "string" ? parsed.insight.trim() : undefined,
          };
        }
      } catch (e) {
        console.error("Не удалось распарсить JSON из ответа модели:", e, txt.slice(0, 300));
      }
      return null;
    };

    const parsed = extractJson(rawText);

    let insightText = parsed?.insight || "";
    let shareQuote: string | null = parsed?.quote || null;

    if (!insightText) {
      // Фолбэк: если модель не вернула валидный JSON — отдаём сырой текст как инсайт.
      console.warn("Модель не вернула валидный JSON, используем сырой текст как insight.");
      insightText = rawText.trim() || "Не удалось сгенерировать инсайт";
      shareQuote = null;
    }

    const { error: insertError } = await supabaseAdmin
      .from("ai_insights")
      .insert({
        user_id: user.id,
        oil_id: oilId,
        content: insightText,
        share_quote: shareQuote,
      });

    if (insertError) {
      console.error("Failed to save insight:", insertError);
    }

    return new Response(JSON.stringify({ insight: insightText, shareQuote }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-insight error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Неизвестная ошибка" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
