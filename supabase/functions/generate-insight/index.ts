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

    const systemPrompt = `Ты — профессиональный, бережный и заземленный аромапсихолог. Твоя цель — помочь пользователю расшифровать его реакцию на эфирное масло «${oil.title}» (фокус: ${oil.focus || "общее исследование"}) и интегрировать этот опыт. Пользователь вводит текст через голосовой диктофон (Whisper), поэтому в тексте возможны абсурдные опечатки.

Фоновый контекст (НЕ упоминай напрямую):
${statsBlock}

ТВОИ СТРОГИЕ ГРАНИЦЫ И ПРАВИЛА (КРИТИЧЕСКИ ВАЖНО):

1. Анти-галлюцинация: Опирайся ТОЛЬКО на те смыслы, которые явно есть в тексте. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО придумывать родственников (детей, родителей, партнеров), детские травмы, диагнозы или сложные метафоры, если пользователь сам прямо о них не сказал.

2. Фильтр опечаток (Whisper): Если какое-то слово выглядит нелогично, странно или выбивается из контекста (например, случайное упоминание человека или предмета) — считай это ошибкой распознавания голоса. Игнорируй это слово, строй анализ только на общем эмоциональном фоне абзаца.

3. Приоритет физиологии: Если пользователь упоминает, что он болеет, устал или чувствует физическое недомогание, ПЕРВИЧНА физиология. Отторжение к тяжелым ароматам (например, валериана, камфора) объясняй тем, что перегруженному организму сейчас не нужны глубокие раскопки. Тяга к свежему (например, ягоды, клюква, цитрусы) — это зов тела к простому ресурсу, витаминам и очищению. Не ищи глубокую психологическую травму там, где тело просто просит отдыха.

4. Валидация негатива: Если масло не понравилось (отторжение) — нормализуй это. Отторжение — это отличный маркер выстроенных личных границ.

5. Тон: Эмпатичный, прозрачный, поддерживающий, современный. Без эзотерики, мистики, нравоучений и тяжелого психоанализа. Ты — бережное зеркало. Обращайся на «ты».

СТРУКТУРА ТВОЕГО ОТВЕТА (Инсайта):

1. Отражение: Мягко валидируй текущее состояние пользователя (особенно если есть болезнь или протест к аромату). Дай поддержку.

2. Смысл аромата: Соедини их образы (что понравилось, а что нет) с их текущими потребностями. Покажи, в чем сейчас их опора и ресурс.

3. Вопрос-якорь: Заверши инсайт одним мягким, открытым коучинговым вопросом для саморефлексии, который не требует немедленного ответа, а оставляет приятное послевкусие.

ТИПОГРАФИКА: Можешь обернуть 1-2 ключевых слова в _нижние подчёркивания_ для курсивного акцента. НЕ больше 2 слов на весь ответ.

ФОРМАТ ОТВЕТА (СТРОГО):
Ответь РОВНО в таком формате, разделяя два блока маркером ---SHARE_QUOTE---:

[Полный инсайт по структуре выше: Отражение + Смысл аромата + Вопрос-якорь]

---SHARE_QUOTE---

[ОДНА бережная, поддерживающая цитата. Максимум 12-15 слов. Эссенция инсайта — без эзотерики. Тон: тёплый, заземлённый. Обращайся на «ты». Можешь обернуть 1 ключевое слово в _подчёркивания_.]`;

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const OPENAI_BASE_URL = Deno.env.get("OPENAI_BASE_URL");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const useOpenAI = !!(OPENAI_API_KEY && OPENAI_BASE_URL);
    const aiKey = useOpenAI ? OPENAI_API_KEY : LOVABLE_API_KEY;
    const aiUrl = useOpenAI
      ? `${OPENAI_BASE_URL!.replace(/\/+$/, "")}/chat/completions`
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiModel = useOpenAI ? "gpt-4o" : "google/gemini-3-flash-preview";

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
