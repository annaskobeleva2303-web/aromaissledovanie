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
      .select("date, mood, content, energy_tags, energy_before, mood_score_before, energy_after, mood_score_after, oil_body_location, oil_sensation, oil_visual_image, record_type")
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

    // Build delta block for before/after
    let deltaBlock = "";
    if (currentEntry.record_type === "full" && currentEntry.energy_before != null && currentEntry.energy_after != null) {
      const eBefore = currentEntry.energy_before as number;
      const eAfter = currentEntry.energy_after as number;
      const mBefore = currentEntry.mood_score_before as number;
      const mAfter = currentEntry.mood_score_after as number;
      const eDelta = eAfter - eBefore;
      const mDelta = mAfter - mBefore;
      deltaBlock = `
ЗАМЕР ТРАНСФОРМАЦИИ:
- Энергия: ${eBefore} → ${eAfter} (${eDelta >= 0 ? "+" : ""}${eDelta})
- Настроение: ${mBefore} → ${mAfter} (${mDelta >= 0 ? "+" : ""}${mDelta})`;
    }

    // Build sensory block
    let sensoryBlock = "";
    const bodyLoc = currentEntry.oil_body_location as string | null;
    const sens = currentEntry.oil_sensation as string | null;
    const visual = currentEntry.oil_visual_image as string | null;
    if (bodyLoc || sens || visual) {
      sensoryBlock = `
СЕНСОРИКА МАСЛА:
${bodyLoc ? `- Где в теле: ${bodyLoc}` : ""}
${sens ? `- Ощущение: ${sens}` : ""}
${visual ? `- Образ: ${visual}` : ""}`;
    }

    const userContent = `
СЕГОДНЯШНЯЯ ЗАПИСЬ (Анализируй ТОЛЬКО её):

Настроение: ${currentEntry.mood || "не указано"}
${deltaBlock}
${sensoryBlock}

Текст: ${currentEntry.content}
`;

    const systemPrompt = `Ты — высококвалифицированный психолог-аналитик. Клиент исследует себя через эфирное масло «${oil.title}» (фокус: ${oil.focus || "общее исследование"}). Твоя задача — дать короткий (2-3 предложения), точный, отрезвляющий и поддерживающий отклик на его последнюю запись.

Фоновый контекст (НЕ упоминай напрямую):
${statsBlock}

СТРОГИЕ ПРАВИЛА:
- НЕ пересказывай то, что написал клиент. НЕ констатируй очевидное.
- Если есть данные трансформации (До/После) — используй ДЕЛЬТУ энергии и настроения как ключевую точку анализа. Покажи, что изменилось и ПОЧЕМУ это значимо психологически.
- Если клиент описал сенсорику масла (где в теле, ощущение, образ) — интерпретируй эти телесные сигналы через призму психосоматики.
- Ищи СКРЫТЫЙ МЕХАНИЗМ за эмоцией: какую защиту, потребность или противоречие она маскирует. Назови это прямо.
- Если используешь метафору — она должна быть одна, хирургически точная, объясняющая психический механизм. ЗАПРЕЩЕНЫ эзотерические клише: «коконы», «свет», «вибрации», «потоки энергии».
- ТИПОГРАФИКА: Оберни 1-2 ключевых слова-метафоры или психологических концепта в _нижние подчёркивания_ (например: _защита_, _теневая потребность_, _внутренний расщеп_). Это создаст редакционный курсивный акцент. НЕ оборачивай больше 2 слов на весь ответ. НЕ оборачивай служебные или общие слова.
- Заверши одним коротким вопросом для рефлексии, который вернёт клиенту ответственность.
- Анализируй ТОЛЬКО сегодняшнюю запись. ЗАПРЕЩЕНО упоминать прошлые состояния, если клиент не говорит о них сейчас.
- Обращайся на «ты». Тон: ясный, профессиональный, вызывающий мурашки правдивостью. Максимум 2-3 предложения + вопрос.

ФОРМАТ ОТВЕТА (СТРОГО):
Ответь РОВНО в таком формате, разделяя два блока маркером ---SHARE_QUOTE---:

[Твой полный психоаналитический отклик: 2-3 предложения + вопрос]

---SHARE_QUOTE---

[ОДНА глубокая, терапевтичная, ясная и цепляющая цитата. Максимум 12-15 слов. Это эссенция инсайта — без лишних слов, без эзотерики. Тон: ясный, отрезвляющий, вызывающий мурашки. Обращайся на «ты».]`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI ключ не настроен" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      }
    );

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
