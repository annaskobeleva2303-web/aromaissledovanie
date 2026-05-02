import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    const aiKey = useOpenAI ? OPENAI_API_KEY : LOVABLE_API_KEY;
    const aiUrl = useOpenAI
      ? `${OPENAI_BASE_URL!.replace(/\/+$/, "")}/chat/completions`
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiModel = useOpenAI ? "claude-sonnet-4-6" : "google/gemini-3-flash-preview";
    const aiFallbackModel = useOpenAI ? "gpt-5.4-mini" : "google/gemini-2.5-flash-lite";

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

    // Get all active oils
    const { data: oils, error: oilsError } = await supabase
      .from("oils")
      .select("id, title, focus")
      .eq("is_active", true);

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

      // Fetch all entries for this oil in the last 7 days (anonymized — no user_id in output)
      const { data: entries, error: entriesError } = await supabase
        .from("entries")
        .select("date, mood, content")
        .eq("oil_id", oil.id)
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
            `Участник ${(i % entries.length) + 1} [${e.date}] Состояние: ${e.mood || "не указано"}\n${e.content}`
        )
        .join("\n\n---\n\n");

      const systemPrompt = `Ты — аналитик коллективных паттернов в сфере ароматерапии и осознанности. 
Тебе даны **анонимные** записи участников за неделю по эфирному маслу «${oil.title}» (фокус: ${oil.focus || "общее исследование"}).

Твоя задача — выявить **групповые тренды и паттерны**:
- Какие эмоциональные состояния преобладали в группе?
- Есть ли общие темы, которые поднимались разными участниками?
- Заметна ли динамика (от начала к концу недели)?
- Есть ли неожиданные совпадения или контрасты?

Напиши краткий (2-3 абзаца), бережный, вдохновляющий обзор трендов группы. 
Обращайся к группе как «участники исследования». Никогда не упоминай конкретных людей.
Стиль — премиальный, метафоричный, тёплый.`;

      const callAI = (model: string) =>
        fetch(aiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${aiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            max_tokens: 450,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: anonymizedText },
            ],
          }),
        });

      let aiResponse = await callAI(aiModel);
      if (!aiResponse.ok && aiResponse.status !== 429 && aiResponse.status !== 402) {
        console.warn(`group-trends: primary ${aiModel} failed (${aiResponse.status}), fallback to ${aiFallbackModel}`);
        try {
          const fb = await callAI(aiFallbackModel);
          if (fb.ok) aiResponse = fb;
        } catch (e) {
          console.error("group-trends fallback failed:", e);
        }
      }

      if (!aiResponse.ok) {
        console.error(`AI error for ${oil.title}:`, aiResponse.status);
        results.push({ oil: oil.title, status: `ai_error_${aiResponse.status}` });
        continue;
      }

      const aiData = await aiResponse.json();
      const trendText =
        aiData.choices?.[0]?.message?.content || "Не удалось сгенерировать тренд";

      const { error: insertError } = await supabase
        .from("group_trends")
        .insert({
          oil_id: oil.id,
          week_start: weekStartStr,
          trend_text: trendText,
        });

      if (insertError) {
        console.error(`Insert error for ${oil.title}:`, insertError);
        results.push({ oil: oil.title, status: "insert_error" });
      } else {
        results.push({ oil: oil.title, status: "success" });
        // Notify all users who have access to this oil
        const { data: accessUsers } = await supabase
          .from("user_access")
          .select("user_id")
          .eq("oil_id", oil.id);
        if (accessUsers && accessUsers.length > 0) {
          const notifs = accessUsers.map((u) => ({
            user_id: u.user_id,
            title: "🌿 Групповой обзор недели",
            message: `Новый ИИ-обзор группы по маслу «${oil.title}» готов. Загляните в Групповое поле.`,
          }));
          await supabase.from("notifications").insert(notifs);
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
