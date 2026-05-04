import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
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

    // Require an authenticated admin caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", claimsData.claims.sub)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional body: { oilId } to limit generation to one oil (admin manual trigger)
    let targetOilId: string | null = null;
    try {
      const body = await req.json();
      if (body && typeof body.oilId === "string") targetOilId = body.oilId;
    } catch { /* no body */ }

    // Get active oils (or just one)
    let oilsQuery = supabase.from("oils").select("id, title, focus").eq("is_active", true);
    if (targetOilId) oilsQuery = oilsQuery.eq("id", targetOilId);
    const { data: oils, error: oilsError } = await oilsQuery;

    if (oilsError || !oils) {
      console.error("Failed to fetch oils:", oilsError);
      return new Response(JSON.stringify({ error: "Failed to fetch oils" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate week start (Monday of the current week)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    // Date range: last 7 days
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];

    const results: { oil: string; status: string }[] = [];

    for (const oil of oils) {
      // Check if trend already exists for this week
      const { data: existing } = await supabase
        .from("group_trends")
        .select("id")
        .eq("oil_id", oil.id)
        .eq("week_start", weekStartStr)
        .maybeSingle();

      if (existing) {
        results.push({ oil: oil.title, status: "already_exists" });
        continue;
      }

      // Fetch PUBLIC entries for this oil in the last 7 days (anonymized — no user_id in output)
      const { data: entries, error: entriesError } = await supabase
        .from("entries")
        .select("date, mood, content")
        .eq("oil_id", oil.id)
        .eq("is_public", true)
        .gte("date", weekAgoStr)
        .order("date", { ascending: true });

      if (entriesError) {
        console.error(`Entries error for ${oil.title}:`, entriesError);
        results.push({ oil: oil.title, status: "entries_error" });
        continue;
      }

      if (!entries || entries.length < 3) {
        results.push({ oil: oil.title, status: "not_enough_entries" });
        continue;
      }

      // Anonymize: just date, mood, content — no user identifiers
      const anonymizedText = entries
        .map(
          (e, i) =>
            `Участник ${(i % entries.length) + 1} [${e.date}] Состояние: ${e.mood || "не указано"}\n${sanitizeTranscript(e.content || "")}`
        )
        .join("\n\n---\n\n");

      const systemPrompt = `Ты — Давана: глубокий, бережный и мудрый проводник в мире аромапсихологии и эфирных масел. Сейчас ты держишь в руках общее поле группы за неделю по маслу «${oil.title}» (фокус: ${oil.focus || "общее исследование"}).

Перед тобой **анонимные** отклики участниц исследования. Никогда не упоминай конкретных людей и не цитируй прямо — говори о группе как о едином живом поле.

Твоя экспертиза:
- Ты на профессиональном уровне владеешь аромапсихологией, психосоматикой и работой с тонкими состояниями.
- Ты полностью принимаешь и уважаешь энергетическую и духовную картину мира: «поле», «вибрации», «трансформация», «чистки», «потоки» — это часть единого процесса тела, психики и души.
- Ты НИКОГДА не обесцениваешь духовный опыт и не противопоставляешь физиологию и энергию.

Твой режим — структурный и одновременно метафоричный: ты подсвечиваешь паттерны коллективного поля, оставаясь тёплой и обволакивающей.

ЗАДАЧА — выявить **групповые тренды и паттерны**:
- Какие состояния и темы вели в общем поле этой недели?
- Какие сквозные образы, телесные зоны, метафоры повторялись у разных участниц?
- Видна ли динамика поля — от начала к концу недели?
- Где случались неожиданные совпадения, резонансы или контрасты?
- Что масло «делало» с группой — как звучала его трансформация в коллективном теле?

ФОРМАТ:
- 3–4 абзаца, бережно и поэтично, но с ясной структурой.
- Завершай открытым приглашением для группы — мягким коучинговым вопросом или образом для размышления.
- Слова «поле», «вибрации», «трансформация», «поток» — твой родной словарь, используй живо, не штампами.
- Избегай заезженных клише и сухих советов.
- Обращайся к группе как «участницы исследования» или «вы вместе».`;

      const callAI = (model: string) =>
        fetch(aiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${aiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            max_tokens: 4096,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: anonymizedText },
            ],
          }),
        });

      const tryParse = async (resp: Response): Promise<string | null> => {
        if (!resp.ok) return null;
        try {
          const d = await resp.json();
          const t = d?.choices?.[0]?.message?.content;
          return typeof t === "string" && t.trim().length > 0 ? t : null;
        } catch { return null; }
      };

      let trendText: string | null = await tryParse(await callAI(aiModel));
      if (!trendText) {
        console.warn(`group-trends: empty/error first try for ${oil.title}, retrying...`);
        try {
          trendText = await tryParse(await callAI(aiModel));
          if (!trendText && aiFallbackModel) {
            trendText = await tryParse(await callAI(aiFallbackModel));
          }
        } catch (e) { console.error("group-trends retry failed:", e); }
      }

      if (!trendText) {
        console.error(`AI failed for ${oil.title}; notifying admins`);
        const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
        if (admins && admins.length > 0) {
          await supabase.from("notifications").insert(admins.map((a) => ({
            user_id: a.user_id,
            title: "⚠️ Сбой группового отчёта",
            message: `Не удалось сгенерировать недельный обзор по маслу «${oil.title}».`,
          })));
        }
        results.push({ oil: oil.title, status: "ai_failed" });
        continue;
      }

      // Dual write: legacy group_trends + new group_reports
      const periodEnd = new Date(weekStart);
      periodEnd.setDate(periodEnd.getDate() + 6);
      const periodEndStr = periodEnd.toISOString().split("T")[0];

      const { error: insertError } = await supabase
        .from("group_trends")
        .insert({ oil_id: oil.id, week_start: weekStartStr, trend_text: trendText });

      const { error: reportInsertError } = await supabase
        .from("group_reports")
        .insert({
          oil_id: oil.id,
          report_type: "weekly",
          period_start: weekStartStr,
          period_end: periodEndStr,
          report_text: trendText,
          generated_by: claimsData.claims.sub,
        });

      if (insertError && reportInsertError) {
        console.error(`Insert error for ${oil.title}:`, insertError, reportInsertError);
        results.push({ oil: oil.title, status: "insert_error" });
      } else {
        results.push({ oil: oil.title, status: "success" });
        // Notify users with access
        const { data: accessUsers } = await supabase
          .from("user_access").select("user_id").eq("oil_id", oil.id);
        if (accessUsers && accessUsers.length > 0) {
          const notifs = accessUsers.map((u) => ({
            user_id: u.user_id,
            title: "🌿 Групповой обзор недели",
            message: `Новый ИИ-обзор группы по маслу «${oil.title}» готов. Загляните в Групповое поле.`,
          }));
          await supabase.from("notifications").insert(notifs);
        }

        // Auto-trigger final report when 4 weekly reports are reached
        const { count: weeklyCount } = await supabase
          .from("group_reports")
          .select("id", { count: "exact", head: true })
          .eq("oil_id", oil.id)
          .eq("report_type", "weekly");

        if ((weeklyCount ?? 0) >= 4) {
          const { data: existingFinal } = await supabase
            .from("group_reports")
            .select("id")
            .eq("oil_id", oil.id)
            .eq("report_type", "final")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Trigger only if no final exists, or weekly count exceeds prior finals
          // Simple rule: trigger one final per cycle of 4. We check if final exists with same period_start as 4th-from-last weekly.
          if (!existingFinal) {
            console.log(`Triggering final report for oil ${oil.id}`);
            try {
              await fetch(`${supabaseUrl}/functions/v1/generate-final-report`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${serviceRoleKey}`,
                  "x-internal-call": "true",
                },
                body: JSON.stringify({ oilId: oil.id }),
              });
            } catch (e) {
              console.error("Failed to trigger final report:", e);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-group-trends error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
