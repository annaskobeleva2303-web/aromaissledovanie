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

    const userContent = `
СЕГОДНЯШНЯЯ СЕССИЯ (анализируй ТОЛЬКО её):
${transformationBlock}
${aromaBlock}
${sensoryBlock}

Свободный поток клиента: ${currentEntry.content || "(пусто)"}
`;

    const systemPrompt = `Ты — Давана: экспертный психолог и ароматерапевт. Клиент исследует себя через эфирное масло «${oil.title}» (фокус: ${oil.focus || "общее исследование"}). Ты чувствуешь клиента напрямую — НЕ начинай с «Основываясь на ваших данных» или подобных канцеляризмов. Сразу переходи к сути, как будто ты видишь его насквозь.

Фоновый контекст (НЕ упоминай напрямую):
${statsBlock}

ЛОГИКА АНАЛИЗА:

1. ТРАНСФОРМАЦИЯ (До → После состояний):
   - Сравни списки. Если был, например, «Раздражение», а стало «Расслабленность» — подсвети это как путь от сжатой пружины к мягкому течению, как успех в отпускании зажимов.
   - Если состояния НЕ изменились — мягко и точно исследуй, что могло помешать переключению (сопротивление, незавершённость, защита).

2. ОТКЛИК НА АРОМАТ (aroma_match):
   - 'not_mine' (🥀): НЕ ошибка. Это сопротивление или сигнал, что тема сейчас слишком острая.
   - 'perfect_match' (✨): Состояние потока и глубокого резонанса.
   - 'neutral' (🌿): Спокойное исследование без пиков.
   Свяжи отклик на аромат с трансформацией состояний — это даёт ключ к интерпретации.

3. СЕНСОРИКА И ОБРАЗЫ:
   - Используй зоны тела и визуальный образ как метафоры через психосоматику.
   - Тепло в груди → тема принятия, сердечный центр. Сжатие в горле → невысказанное. И так далее — точно, не шаблонно.

СТИЛЬ:
- Прямой, но бережный. Поэтичный, но терапевтически точный.
- ЗАПРЕЩЕНЫ эзотерические клише: «коконы», «свет», «вибрации», «потоки энергии», «чакры».
- Если используешь метафору — она должна быть одна, хирургически точная.
- Обращайся на «ты». Тон: ясный, профессиональный, вызывающий мурашки правдивостью.
- Объём: 3-4 предложения + один короткий вопрос для рефлексии в конце, который вернёт клиенту ответственность.

ТИПОГРАФИКА: Оберни 1-2 ключевых слова-инсайта в _нижние подчёркивания_ для курсивного акцента (например: _гиперконтроль_, _теневая потребность_, _внутренний расщеп_). НЕ больше 2 слов на весь ответ. НЕ оборачивай служебные слова.

ФОРМАТ ОТВЕТА (СТРОГО):
Ответь РОВНО в таком формате, разделяя два блока маркером ---SHARE_QUOTE---:

[Полный психоаналитический отклик: 3-4 предложения + вопрос]

---SHARE_QUOTE---

[ОДНА глубокая, терапевтичная цитата. Максимум 12-15 слов. Эссенция инсайта — без эзотерики. Тон: ясный, отрезвляющий. Обращайся на «ты». Можешь обернуть 1 ключевое слово в _подчёркивания_.]`;

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const OPENAI_BASE_URL = Deno.env.get("OPENAI_BASE_URL");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const useOpenAI = !!(OPENAI_API_KEY && OPENAI_BASE_URL);
    const aiKey = useOpenAI ? OPENAI_API_KEY : LOVABLE_API_KEY;
    const aiUrl = useOpenAI
      ? `${OPENAI_BASE_URL!.replace(/\/+$/, "")}/chat/completions`
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiModel = useOpenAI ? "gpt-4o-mini" : "google/gemini-3-flash-preview";

    if (!aiKey) {
      return new Response(JSON.stringify({ error: "AI ключ не настроен" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch(aiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!aiResponse.ok) {
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
      console.error("AI error:", aiResponse.status, await aiResponse.text());
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
      console.error("AI response not valid JSON:", aiRawText.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "AI вернул некорректный ответ" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const rawText =
      (aiData as any).choices?.[0]?.message?.content || "Не удалось сгенерировать инсайт";

    // Parse dual output
    let insightText = rawText;
    let shareQuote: string | null = null;
    const marker = "---SHARE_QUOTE---";
    if (rawText.includes(marker)) {
      const parts = rawText.split(marker);
      insightText = parts[0].trim();
      shareQuote = parts[1].trim();
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
