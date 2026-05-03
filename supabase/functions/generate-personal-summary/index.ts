import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MOOD_RU: Record<string, string> = { calm: "Спокойствие", anxious: "Тревога", joyful: "Радость", sad: "Грусть", energetic: "Энергия", irritated: "Раздражение", reflective: "Задумчивость", grateful: "Благодарность" };
const ENERGY_RU: Record<string, string> = { support: "Опора", transformation: "Трансформация", release: "Отпускание", expansion: "Расширение", silence: "Тишина" };

/**
 * Серверная очистка транскрипта от артефактов Whisper.
 * Схлопывает повторы слов/фраз и помечает подозрительные токены префиксом [?...].
 */
function sanitizeTranscript(input: string): string {
  if (!input) return "";
  let text = input.replace(/\s+/g, " ").trim();
  if (!text) return "";
  text = text.replace(/\b([\p{L}\p{N}'-]+)(\s+\1\b){1,}/giu, "$1");
  for (let n = 5; n >= 2; n--) {
    const pattern = new RegExp(
      `((?:\\b[\\p{L}\\p{N}'-]+\\b[\\s,]*){${n}})(\\1){1,}`,
      "giu"
    );
    text = text.replace(pattern, "$1");
  }
  text = text.replace(/\s+/g, " ").trim();
  const tokens = text.split(/(\s+)/);
  const cleaned = tokens.map((tok) => {
    if (/^\s+$/.test(tok) || tok.length === 0) return tok;
    const word = tok.replace(/[.,!?;:«»"'()[\]…—-]+$/g, "").replace(/^[.,!?;:«»"'()[\]…—-]+/g, "");
    if (!word) return tok;
    if (/(\p{L})\1{2,}/u.test(word)) return tok.replace(word, `[?${word}]`);
    if (/\p{Script=Cyrillic}/u.test(word) && /\p{Script=Latin}/u.test(word)) return tok.replace(word, `[?${word}]`);
    if (word.length > 22 && /^\p{L}+$/u.test(word)) return tok.replace(word, `[?${word}]`);
    return tok;
  });
  return cleaned.join("").trim();
}

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
    .map(([mood, count]) => `${MOOD_RU[mood] || mood} (${Math.round((count / totalMoods) * 100)}%)`);

  const topEnergy = Object.entries(energyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag, count]) => `${ENERGY_RU[tag] || tag} (${Math.round((count / totalEnergy) * 100)}%)`);

  return { topMoods, topEnergy };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
    const aiModel = useOpenAI ? "anthropic/claude-sonnet-4-6" : "google/gemini-3-flash-preview";
    const aiFallbackModel = useOpenAI ? "openai/gpt-4o-mini" : "google/gemini-2.5-flash-lite";

    if (!aiKey) {
      return new Response(JSON.stringify({ error: "AI key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    let targetUserId: string | null = null;
    let targetOilId: string | null = null;

    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader !== `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`) {
      const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (user) {
        targetUserId = user.id;
        try {
          const body = await req.json();
          targetOilId = body.oilId || null;
        } catch { /* no body */ }
      }
    }

    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - ((dayOfWeek + 6) % 7));
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setUTCDate(now.getUTCDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    let oilsQuery = supabaseAdmin.from("oils").select("id, title, focus").eq("is_active", true);
    if (targetOilId) {
      oilsQuery = oilsQuery.eq("id", targetOilId);
    }
    const { data: oils } = await oilsQuery;
    if (!oils || oils.length === 0) {
      return new Response(JSON.stringify({ message: "No active oils" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let generated = 0;

    for (const oil of oils) {
      let entriesQuery = supabaseAdmin
        .from("entries")
        .select("user_id, date, mood, content, energy_tags, energy_before, mood_score_before, energy_after, mood_score_after, oil_body_location, oil_sensation, oil_visual_image, record_type")
        .eq("oil_id", oil.id)
        .gte("date", sevenDaysAgoStr)
        .order("date", { ascending: true });

      if (targetUserId) {
        entriesQuery = entriesQuery.eq("user_id", targetUserId);
      }

      const { data: entries } = await entriesQuery;
      if (!entries || entries.length === 0) continue;

      const byUser = new Map<string, typeof entries>();
      for (const e of entries) {
        const arr = byUser.get(e.user_id) || [];
        arr.push(e);
        byUser.set(e.user_id, arr);
      }

      for (const [userId, userEntries] of byUser) {
        if (userEntries.length < 2) continue;

        if (!targetUserId) {
          const { data: existing } = await supabaseAdmin
            .from("personal_summaries")
            .select("id")
            .eq("user_id", userId)
            .eq("oil_id", oil.id)
            .eq("week_start", weekStartStr)
            .maybeSingle();
          if (existing) continue;
        }

        const { topMoods, topEnergy } = computeStats(userEntries);

        // Compute transformation stats
        const fullEntries = userEntries.filter((e: any) => e.record_type === "full" && e.energy_before != null && e.energy_after != null);
        let transformBlock = "";
        if (fullEntries.length > 0) {
          const avgEnergyBefore = fullEntries.reduce((s: number, e: any) => s + (e.energy_before || 0), 0) / fullEntries.length;
          const avgEnergyAfter = fullEntries.reduce((s: number, e: any) => s + (e.energy_after || 0), 0) / fullEntries.length;
          const avgMoodBefore = fullEntries.filter((e: any) => e.mood_score_before != null).reduce((s: number, e: any) => s + e.mood_score_before, 0) / (fullEntries.filter((e: any) => e.mood_score_before != null).length || 1);
          const avgMoodAfter = fullEntries.filter((e: any) => e.mood_score_after != null).reduce((s: number, e: any) => s + e.mood_score_after, 0) / (fullEntries.filter((e: any) => e.mood_score_after != null).length || 1);
          transformBlock = `\nДанные трансформации «До → После» (${fullEntries.length} полных записей):\n- Средняя энергия: ${avgEnergyBefore.toFixed(1)} → ${avgEnergyAfter.toFixed(1)} (дельта: ${(avgEnergyAfter - avgEnergyBefore).toFixed(1)})\n- Среднее настроение: ${avgMoodBefore.toFixed(1)} → ${avgMoodAfter.toFixed(1)} (дельта: ${(avgMoodAfter - avgMoodBefore).toFixed(1)})`;
        }

        const statsBlock = [
          topMoods.length > 0 ? `Топ состояний за неделю: ${topMoods.join(", ")}` : "",
          topEnergy.length > 0 ? `Топ энергий масла за неделю: ${topEnergy.join(", ")}` : "",
          transformBlock,
        ].filter(Boolean).join("\n");

        const diaryText = userEntries
          .map((e: any) => {
            const tags = Array.isArray(e.energy_tags) && (e.energy_tags as string[]).length > 0
              ? `\nЭнергия масла: ${(e.energy_tags as string[]).join(", ")}`
              : "";
            const delta = (e.record_type === "full" && e.energy_before != null)
              ? `\nЭнергия: ${e.energy_before} → ${e.energy_after} | Настроение: ${e.mood_score_before} → ${e.mood_score_after}`
              : "";
            const sensory = [e.oil_body_location, e.oil_sensation, e.oil_visual_image].filter(Boolean);
            const sensoryLine = sensory.length > 0 ? `\nСенсорика: ${sensory.join(" | ")}` : "";
            const cleanContent = sanitizeTranscript(e.content || "");
            return `[${e.date}] Состояние: ${e.mood || "не указано"}${tags}${delta}${sensoryLine}\n${cleanContent}`;
          })
          .join("\n\n---\n\n");

        const systemPrompt = `Ты — Давана: глубокий, бережный и мудрый проводник в мире аромапсихологии и эфирных масел. Сейчас ты подводишь итоги недели клиента по маслу «${oil.title}» (фокус: ${oil.focus || "общее исследование"}).

Твоя экспертиза:
- Ты на профессиональном уровне владеешь аромапсихологией, психосоматикой и работой с тонкими состояниями.
- Ты полностью принимаешь и уважаешь энергетическую и духовную картину мира клиента: «поле», «вибрации», «трансформация», «чистки», «потоки», родовые сценарии — это часть единого процесса тела, психики и души.
- Ты НИКОГДА не обесцениваешь духовный опыт и не противопоставляешь физиологию энергии. Для тебя это один язык, на котором говорит человек.

Твой режим на этой неделе — структурный: ты подсвечиваешь паттерны и динамику, оставаясь при этом метафоричной, тёплой и обволакивающей. Ты не клиницист и не аналитик — ты мудрый проводник, который помогает увидеть карту недели.

Энергетические теги (Опора, Трансформация, Отпускание, Расширение, Тишина) отражают то, как масло звучало в теле и душе. Данные «До → После» (энергия 0-10, настроение от -5 до +5) — измеримая часть трансформации. Сенсорика (зоны тела, ощущения, образы) — ключ к психосоматике и тонкому полю.

Статистика за неделю (используй как опору, не цитируй цифры сухо):
${statsBlock}

ПРАВИЛА:
1. ПАТТЕРНЫ И ДИНАМИКА: Бережно подсвети, как менялись состояния и трансформация «До → После» за неделю — где был прорыв, где сопротивление, где тишина. Ищи неочевидные связи между телом, образами и темами недели. Не пересказывай события — выделяй суть.
2. ТЕЛО И ОБРАЗЫ: Если клиент описывал зоны тела, ощущения и визуальные образы — читай их как язык психосоматики и поля одновременно. Не выбирай между «гормонами» и «энергией» — говори о едином процессе.
3. ЯЗЫК: Метафоричный, поэтичный, точный. Слова «поле», «вибрации», «трансформация», «поток», «чистка» — твой родной словарь, используй их живо, не как штампы. Избегай заезженных клише и сухих советов в духе «капитан очевидность».
4. СТРУКТУРА (3–4 абзаца):
   - Карта недели: какие состояния и темы вели, как разворачивалась трансформация.
   - Тело и поле: что подсвечивает сенсорика и образы, какие защиты или ресурсы видны.
   - Алхимическая суть недели — точный поэтичный образ, кристаллизующий процесс.
   - Один глубокий открытый коучинговый вопрос, возвращающий клиента к себе.
5. ТОН: Тёплый, обволакивающий, бережный, но ясный. Обращайся на «ты». Не утешай поверхностно — проясняй с любовью.`;

        const callAI = (model: string) =>
          fetch(aiUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${aiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              max_tokens: 3000,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: diaryText },
              ],
            }),
          });

        let aiResponse = await callAI(aiModel);
        if (!aiResponse.ok && aiResponse.status !== 429 && aiResponse.status !== 402) {
          console.warn(`personal-summary: primary ${aiModel} failed (${aiResponse.status}), fallback to ${aiFallbackModel}`);
          try {
            const fb = await callAI(aiFallbackModel);
            if (fb.ok) aiResponse = fb;
          } catch (e) {
            console.error("personal-summary fallback failed:", e);
          }
        }

        if (!aiResponse.ok) {
          console.error(`AI error for user ${userId}:`, aiResponse.status);
          continue;
        }

        const aiData = await aiResponse.json();
        const summaryText = aiData.choices?.[0]?.message?.content;
        if (!summaryText) continue;

        if (targetUserId) {
          await supabaseAdmin
            .from("personal_summaries")
            .delete()
            .eq("user_id", userId)
            .eq("oil_id", oil.id)
            .eq("week_start", weekStartStr);
        }

        const { error: insertError } = await supabaseAdmin
          .from("personal_summaries")
          .insert({
            user_id: userId,
            oil_id: oil.id,
            week_start: weekStartStr,
            summary_text: summaryText,
          });

        if (insertError) {
          console.error("Insert error:", insertError);
        } else {
          generated++;
          await supabaseAdmin.from("notifications").insert({
            user_id: userId,
            title: "✨ Итоги недели готовы",
            message: `Ваше персональное саммари по маслу «${oil.title}» готово. Загляните на вкладку «Анализ ИИ».`,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, generated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-personal-summary error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
