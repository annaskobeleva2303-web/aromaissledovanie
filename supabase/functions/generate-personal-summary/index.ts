import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Determine if called by a user (manual) or cron (automatic for all)
    let targetUserId: string | null = null;
    let targetOilId: string | null = null;

    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader !== `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`) {
      // User-initiated call
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

    // Calculate week boundaries
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - ((dayOfWeek + 6) % 7)); // Monday
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setUTCDate(now.getUTCDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    // Get active oils
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
      // Get users who have entries for this oil in the last 7 days
      let entriesQuery = supabaseAdmin
        .from("entries")
        .select("user_id, date, mood, content, energy_tags")
        .eq("oil_id", oil.id)
        .gte("date", sevenDaysAgoStr)
        .order("date", { ascending: true });

      if (targetUserId) {
        entriesQuery = entriesQuery.eq("user_id", targetUserId);
      }

      const { data: entries } = await entriesQuery;
      if (!entries || entries.length === 0) continue;

      // Group entries by user
      const byUser = new Map<string, typeof entries>();
      for (const e of entries) {
        const arr = byUser.get(e.user_id) || [];
        arr.push(e);
        byUser.set(e.user_id, arr);
      }

      for (const [userId, userEntries] of byUser) {
        if (userEntries.length < 2) continue; // Need at least 2 entries for a summary

        // Check if summary already exists for this week
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

        const diaryText = userEntries
          .map((e) => `[${e.date}] Состояние: ${e.mood || "не указано"}\n${e.content}`)
          .join("\n\n---\n\n");

        const systemPrompt = `Ты — эмпатичный наставник и психолог. Проанализируй дневниковые записи участника за последнюю неделю по эфирному маслу «${oil.title}» (фокус: ${oil.focus || "общее исследование"}). Напиши тёплое, поддерживающее еженедельное саммари (2-3 абзаца): отметь прогресс, выдели ключевые паттерны и мягко подсвети направление для следующей недели. Обращайся на «Вы», используй бережный, премиальный стиль.`;

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
          console.error(`AI error for user ${userId}:`, aiResponse.status);
          continue;
        }

        const aiData = await aiResponse.json();
        const summaryText = aiData.choices?.[0]?.message?.content;
        if (!summaryText) continue;

        // Upsert — if manual trigger, replace existing for this week
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
          // Send notification
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
