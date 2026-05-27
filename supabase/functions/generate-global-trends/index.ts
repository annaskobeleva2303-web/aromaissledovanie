import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sanitizeTranscript(input: string): string {
  if (!input) return "";
  let text = input.replace(/\s+/g, " ").trim();
  if (!text) return "";
  text = text.replace(/\b([\p{L}\p{N}'-]+)(\s+\1\b){1,}/giu, "$1");
  for (let n = 5; n >= 2; n--) {
    const pattern = new RegExp(`((?:\b[\p{L}\p{N}'-]+\b[\s,]*){${n}})(\1){1,}`, "giu");
    text = text.replace(pattern, "$1");
  }
  return text.replace(/\s+/g, " ").trim();
}

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
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await userClient.auth.getUser(token);
    const callerId = userData?.user?.id;
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleRow } = await supabase
      .from("user_roles").select("role")
      .eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const oilId = typeof body?.oilId === "string" ? body.oilId : null;
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

    const { data: entries, error: entriesError } = await supabase
      .from("entries")
      .select("date, mood, content")
      .eq("oil_id", oilId)
      .eq("is_public", true)
      .order("date", { ascending: true });

    if (entriesError) {
      return new Response(JSON.stringify({ status: "entries_error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!entries || entries.length < 3) {
      return new Response(JSON.stringify({
        status: "not_enough_entries",
        total: entries?.length ?? 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const total = entries.length;
    const periodStart = entries[0].date;
    const periodEnd = entries[entries.length - 1].date;

    const anonymizedText = entries
      .map((e, i) => `Участник ${i + 1} [${e.date}] Состояние: ${e.mood || "не указано"}\n${sanitizeTranscript(e.content || "")}`)
      .join("\n\n---\n\n");

    const systemPrompt = `Ты — Давана: глубокий, бережный и мудрый проводник в мире аромапсихологии и эфирных масел. Перед тобой **полный архив** анонимных откликов группы за всё время исследования масла «${oil.title}» (фокус: ${oil.focus || "общее исследование"}). Всего наблюдений: ${total}.

Никогда не упоминай конкретных людей. Говори о группе как о едином живом поле, прошедшем целый путь.

Твоя экспертиза:
- Аромапсихология, психосоматика, тонкие состояния — на профессиональном уровне.
- Ты полностью принимаешь энергетическую и духовную картину мира: «поле», «вибрации», «трансформация», «потоки».
- Ты НИКОГДА не обесцениваешь духовный опыт.

ЗАДАЧА — итоговый мета-анализ ВСЕГО пути группы с этим маслом:
- Какие сквозные темы и состояния проходили через весь архив?
- Какая дуга трансформации сложилась — от первых откликов к последним?
- Какие телесные зоны, образы, метафоры стали «визитной карточкой» этого масла в группе?
- Где были точки перелома, резонансы, общие «прорывы»?
- Что масло «сделало» с групповым полем за весь цикл наблюдений?
- Какой алхимический образ объединяет весь этот путь?

ФОРМАТ:
- 4–6 содержательных абзацев, структурно и поэтично.
- Начни с яркого алхимического образа всего цикла.
- Заверши глубоким коучинговым вопросом-приглашением для группы.
- Слова «поле», «вибрации», «трансформация», «поток» — твой родной словарь.
- Избегай клише и сухих советов.`;

    const callAI = (model: string) => fetch(aiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, max_tokens: 4096,
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

    let reportText: string | null = await tryParse(await callAI(aiModel));
    if (!reportText) {
      reportText = await tryParse(await callAI(aiModel));
      if (!reportText && aiFallbackModel) {
        reportText = await tryParse(await callAI(aiFallbackModel));
      }
    }

    if (!reportText) {
      return new Response(JSON.stringify({ status: "ai_failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("group_reports")
      .delete()
      .eq("oil_id", oilId)
      .eq("report_type", "global");

    const { error: insertError } = await supabase.from("group_reports").insert({
      oil_id: oilId,
      report_type: "global",
      period_start: periodStart,
      period_end: periodEnd,
      report_text: reportText,
      generated_by: callerId,
    });

    if (insertError) {
      console.error("Global insert error:", insertError);
      return new Response(JSON.stringify({ status: "insert_error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: "success", total, period_start: periodStart, period_end: periodEnd }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-global-trends error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
