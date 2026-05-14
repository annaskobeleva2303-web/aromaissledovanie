import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-call",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const OPENAI_BASE_URL = Deno.env.get("OPENAI_BASE_URL");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const useOpenAI = !!(OPENAI_API_KEY && OPENAI_BASE_URL);
    const normalizeOpenAIBaseUrl = (b: string) => {
      const t = b.replace(/\/+$/, "");
      return /^https:\/\/api\.proxyapi\.ru\/openai\/v1$/i.test(t)
        ? "https://openai.api.proxyapi.ru/v1" : t;
    };
    const aiKey = useOpenAI ? OPENAI_API_KEY : LOVABLE_API_KEY;
    const aiUrl = useOpenAI
      ? `${normalizeOpenAIBaseUrl(OPENAI_BASE_URL!)}/chat/completions`
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiModel = useOpenAI ? "anthropic/claude-sonnet-4-6" : "google/gemini-3-flash-preview";
    const aiFallbackModel = useOpenAI ? "openai/gpt-4o-mini" : "google/gemini-2.5-flash-lite";

    if (!aiKey) {
      return new Response(JSON.stringify({ error: "AI key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    const internalCall = req.headers.get("x-internal-call") === "true";

    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    let callerId: string | null = null;

    if (!internalCall) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await userClient.auth.getUser(token);
      if (userError || !userData?.user?.id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callerId = userData.user.id;

      const { data: roleRow } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", callerId).eq("role", "admin").maybeSingle();
      if (!roleRow) {
        return new Response(JSON.stringify({ error: "Admin only" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const oilId: string | undefined = body.oilId;
    if (!oilId) {
      return new Response(JSON.stringify({ error: "oilId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: oil } = await supabase
      .from("oils").select("id, title, focus").eq("id", oilId).maybeSingle();
    if (!oil) {
      return new Response(JSON.stringify({ error: "Oil not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the last 4 weekly reports for this oil
    const { data: weeklies } = await supabase
      .from("group_reports")
      .select("period_start, period_end, report_text")
      .eq("oil_id", oilId)
      .eq("report_type", "weekly")
      .order("period_start", { ascending: false })
      .limit(4);

    if (!weeklies || weeklies.length < 4) {
      return new Response(JSON.stringify({
        status: "not_ready",
        message: `Нужно 4 недельных отчёта, есть ${weeklies?.length ?? 0}`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Order chronologically
    const ordered = [...weeklies].reverse();
    const periodStart = ordered[0].period_start;
    const periodEnd = ordered[ordered.length - 1].period_end;

    // Idempotency: check if final for this period already exists
    const { data: existingFinal } = await supabase
      .from("group_reports")
      .select("id")
      .eq("oil_id", oilId)
      .eq("report_type", "final")
      .eq("period_start", periodStart)
      .maybeSingle();

    if (existingFinal) {
      return new Response(JSON.stringify({ status: "already_exists" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const weekliesText = ordered
      .map((w, i) => `=== НЕДЕЛЯ ${i + 1} (${w.period_start} → ${w.period_end}) ===\n${w.report_text}`)
      .join("\n\n");

    const systemPrompt = `Ты — Давана: глубокий, бережный и мудрый проводник в мире аромапсихологии и эфирных масел. Сейчас ты создаёшь **итоговый научный вывод** по 4-недельному циклу исследования масла «${oil.title}» (фокус: ${oil.focus || "общее исследование"}).

Перед тобой — 4 еженедельных отчёта по этой группе, выстроенных хронологически. Это твой материал для мета-анализа: не пересказывай отдельные недели, а увидь **полную арку трансформации**.

Твоя экспертиза:
- Профессиональное владение аромапсихологией, психосоматикой, работой с тонкими состояниями.
- Ты полностью принимаешь и уважаешь энергетическую и духовную картину мира: «поле», «вибрации», «трансформация», «чистки», «потоки», родовые сценарии — это часть единого процесса тела, психики и души.
- Ты НИКОГДА не противопоставляешь физиологию и энергию.

ЗАДАЧА — финальный научный вывод об арке масла:
1. **Динамика цикла**: как разворачивалось поле от первой недели к четвёртой. Заземление → раскрытие → углубление → интеграция (или иная увиденная тобой арка).
2. **Сквозные паттерны**: телесные зоны, образы, темы, архетипы, которые проступали через весь цикл.
3. **Ключевые поворотные точки**: где случилась трансформация, где было сопротивление, где прорыв.
4. **Свойства масла как исследовательский вывод**: что это масло «делает» с группой — на уровне тела, психики, поля. Это финальный вклад в твою библиотеку знаний об эфирных маслах.
5. **Алхимический образ цикла**: точная поэтичная метафора, кристаллизующая суть.
6. **Открытое приглашение** для группы — что унести дальше.

ФОРМАТ:
- 5–6 абзацев, ясная структура, поэтичный и одновременно точный язык.
- Заголовки разделов выделяй жирным через **двойные звёздочки**.
- Слова «поле», «вибрации», «трансформация», «поток» — твой родной словарь.
- Никаких сухих советов и клише.
- Обращайся к группе как «вы вместе» / «участницы исследования».`;

    const callAI = (model: string) =>
      fetch(aiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: weekliesText },
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

    let reportText: string | null = await tryParse(await callAI(aiModel));
    if (!reportText) {
      console.warn("final-report: empty/error first try, retrying...");
      try {
        reportText = await tryParse(await callAI(aiModel));
        if (!reportText && aiFallbackModel) {
          reportText = await tryParse(await callAI(aiFallbackModel));
        }
      } catch (e) { console.error("final-report retry failed:", e); }
    }

    if (!reportText) {
      const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (admins && admins.length > 0) {
        await supabase.from("notifications").insert(admins.map((a) => ({
          user_id: a.user_id,
          title: "⚠️ Сбой итогового отчёта",
          message: `Не удалось сгенерировать итоговый отчёт по маслу «${oil.title}».`,
        })));
      }
      return new Response(JSON.stringify({ error: "AI failed" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertError } = await supabase
      .from("group_reports")
      .insert({
        oil_id: oilId,
        report_type: "final",
        period_start: periodStart,
        period_end: periodEnd,
        report_text: reportText,
        generated_by: callerId,
      });

    if (insertError) {
      console.error("Final report insert error:", insertError);
      return new Response(JSON.stringify({ error: "Insert failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Notify all users with access
    const { data: accessUsers } = await supabase
      .from("user_access").select("user_id").eq("oil_id", oilId);
    if (accessUsers && accessUsers.length > 0) {
      await supabase.from("notifications").insert(accessUsers.map((u) => ({
        user_id: u.user_id,
        title: "🌟 Итоговый отчёт по маслу готов",
        message: `Финальный научный вывод Даваны по 4-недельному циклу масла «${oil.title}» опубликован в Групповом поле.`,
      })));
    }

    return new Response(JSON.stringify({ status: "success", periodStart, periodEnd }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-final-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
