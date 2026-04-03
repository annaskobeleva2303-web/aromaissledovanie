import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function computeStats(entries: { mood: string | null; energy_tags: unknown }[]) {
  const moodCounts: Record<string, number> = {};
  const energyCounts: Record<string, number> = {};
  let totalMoods = 0;
  let totalEnergy = 0;

  for (const e of entries) {
    if (e.mood) {
      moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
      totalMoods++;
    }
    if (Array.isArray(e.energy_tags)) {
      for (const tag of e.energy_tags as string[]) {
        energyCounts[tag] = (energyCounts[tag] || 0) + 1;
        totalEnergy++;
      }
    }
  }

  const topMoods = Object.entries(moodCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([mood, count]) => `${mood} (${Math.round((count / totalMoods) * 100)}%)`);

  const topEnergy = Object.entries(energyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag, count]) => `${tag} (${Math.round((count / totalEnergy) * 100)}%)`);

  return { topMoods, topEnergy };
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

    const { oilId } = await req.json();
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
      .select("date, mood, content, energy_tags")
      .eq("oil_id", oilId)
      .eq("user_id", user.id)
      .order("date", { ascending: true });

    if (entriesError) {
      return new Response(JSON.stringify({ error: "Ошибка загрузки записей" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!entries || entries.length < 3) {
      return new Response(
        JSON.stringify({ error: "Недостаточно записей для анализа (минимум 3)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { topMoods, topEnergy } = computeStats(entries);

    const statsBlock = [
      topMoods.length > 0 ? `Топ состояний за всё время: ${topMoods.join(", ")}` : "",
      topEnergy.length > 0 ? `Топ энергий масла: ${topEnergy.join(", ")}` : "",
    ].filter(Boolean).join("\n");

    const diaryText = entries
      .map((e) => {
        const tags = Array.isArray(e.energy_tags) && (e.energy_tags as string[]).length > 0
          ? `\nЭнергия масла: ${(e.energy_tags as string[]).join(", ")}`
          : "";
        return `[${e.date}] Состояние: ${e.mood || "не указано"}${tags}\n${e.content}`;
      })
      .join("\n\n---\n\n");

    const systemPrompt = `Ты — эмпатичный, глубокий психолог и наставник. Проанализируй эти дневниковые записи участницы, которая исследовала эфирное масло «${oil.title}» (его фокус: ${oil.focus || "общее исследование"}). 

Обрати особое внимание на выбранные энергетические теги масла (Опора, Трансформация, Отпускание, Расширение, Тишина) — они отражают, как участница воспринимает энергию масла в конкретный день. 

Вот статистика по всем записям:
${statsBlock}

Используй эту статистику как опору для анализа: укажи доминирующее состояние и его процент, проследи динамику энергий, найди скрытые паттерны, отметь изменения в состояниях и дай поддерживающий, глубокий инсайт (3-4 абзаца). Обращайся на Вы, используй бережный, премиальный, метафоричный стиль. Без банальных советов, только глубина и смыслы.`;

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
            { role: "user", content: diaryText },
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

    const aiData = await aiResponse.json();
    const insightText =
      aiData.choices?.[0]?.message?.content || "Не удалось сгенерировать инсайт";

    const { error: insertError } = await supabaseAdmin
      .from("ai_insights")
      .insert({
        user_id: user.id,
        oil_id: oilId,
        content: insightText,
      });

    if (insertError) {
      console.error("Failed to save insight:", insertError);
    }

    return new Response(JSON.stringify({ insight: insightText }), {
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
