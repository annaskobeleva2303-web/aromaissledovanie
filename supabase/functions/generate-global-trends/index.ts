import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sanitizeTranscript(input: string): string {
  if (!input) return "";
  return input.replace(/\s+/g, " ").trim();
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

    const systemPrompt = `Ты — трансперсональный психолог, энергопрактик и специалист по соматике. Перед тобой полный архив анонимных откликов группы за всё время исследования масла «${oil.title}» (фокус: ${oil.focus || "общее исследование"}). Всего наблюдений: ${total}.

Твой тон — глубокий, структурный, аналитический. Строго запрещены пустые поэтические метафоры, пафос и сказочные образы (никаких "алхимических фениксов", "магии", "волшебства").

При этом ты обязан с уважением относиться к эзотерическим описаниям участниц (ощущения в поле, работа чакр, движение энергии, вибрации) и переводить их в структурный анализ: что это означает на уровне психики, тела и нервной системы.

Никогда не упоминай конкретных людей — говори о группе как о едином поле, прошедшем целый путь.

ЗАДАЧА — итоговый мета-анализ ВСЕГО пути группы с этим маслом и оформить его по следующей структуре:

1. ЯДРО ПРОЦЕССА
Какой главный конфликт или тема, с которой работало масло на протяжении всего цикла? Какая глубинная задача стояла перед групповым полем?

2. ЭНЕРГЕТИЧЕСКОЕ ПОЛЕ И СОМАТИКА
Как движется энергия в поле на протяжении всего пути? Какие энергоцентры (чакры) и телесные зоны были задействованы? Как менялись блоки и расширение от первых записей к последним? Переводи энергетические описания в соматический и нейрофизиологический язык.

3. РАБОТА С ТЕНЬЮ
Какие вытесненные эмоции, родовые или личные программы масло вывело на поверхность из бессознательного на протяжении всего цикла? Что группа проходила в тишине, через симптомы и соматику?

4. ДИНАМИКА ТРАНСФОРМАЦИИ
Четкая дуга пути поля группы — от первых откликов к глубокой интеграции. Какие фазы прошли участницы? Где были точки перелома и резонансы? Что изменилось в качестве поля к концу цикла?

5. РЕЗЮМЕ ДЛЯ ВЕДУЩЕЙ
Практическая, емкая выжимка об итоговом состоянии группового поля. Какой образ масла и его действия сформировался у группы? Какие инсайты важно удержать для следующих этапов работы?

ФОРМАТ:
- Ровно 5 разделов с заголовками как указано выше.
- Лаконично, без воды. Каждый раздел — 1-2 содержательных абзаца, максимум 3 там, где действительно много материала.
- Никаких флафф-метафор и эмоционального пафоса. Сухой свет глубокой аналитики.
- Слова "поле", "вибрации", "трансформация", "поток" — используй только когда они несут конкретный смысл, не как декорацию.`;

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
