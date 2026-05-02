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

/**
 * Серверная очистка транскрипта от артефактов Whisper:
 * 1. Схлопывает подряд повторяющиеся слова/фразы (зацикленность распознавания).
 * 2. Удаляет повторы фраз длиной 2-5 слов.
 * 3. Помечает «подозрительные» одиночные токены префиксом [?...]:
 *    - не-кириллические/не-латинские буквы вперемешку,
 *    - слова из 3+ повторяющихся символов подряд (ааааа),
 *    - изолированные кириллические слова длиной >18 символов.
 * Не меняет смысл — только снижает шум перед LLM.
 */
function sanitizeTranscript(input: string): string {
  if (!input) return "";
  let text = input.replace(/\s+/g, " ").trim();
  if (!text) return "";

  // 1. Схлопываем непосредственные повторы одного слова: "слово слово слово" -> "слово"
  text = text.replace(/\b([\p{L}\p{N}'-]+)(\s+\1\b){1,}/giu, "$1");

  // 2. Схлопываем повторы коротких фраз (2-5 слов), идущих подряд
  for (let n = 5; n >= 2; n--) {
    const pattern = new RegExp(
      `((?:\\b[\\p{L}\\p{N}'-]+\\b[\\s,]*){${n}})(\\1){1,}`,
      "giu"
    );
    text = text.replace(pattern, "$1");
  }
  text = text.replace(/\s+/g, " ").trim();

  // 3. Маркируем подозрительные одиночные токены
  const tokens = text.split(/(\s+)/);
  const cleaned = tokens.map((tok) => {
    if (/^\s+$/.test(tok) || tok.length === 0) return tok;
    const word = tok.replace(/[.,!?;:«»"'()[\]…—-]+$/g, "").replace(/^[.,!?;:«»"'()[\]…—-]+/g, "");
    if (!word) return tok;

    // 3+ одинаковых символа подряд (аааа, ййй)
    if (/(\p{L})\1{2,}/u.test(word)) {
      return tok.replace(word, `[?${word}]`);
    }
    // Смешение кириллицы и латиницы внутри одного слова
    if (/\p{Script=Cyrillic}/u.test(word) && /\p{Script=Latin}/u.test(word)) {
      return tok.replace(word, `[?${word}]`);
    }
    // Очень длинные «слова» (вероятно слипшиеся артефакты)
    if (word.length > 22 && /^\p{L}+$/u.test(word)) {
      return tok.replace(word, `[?${word}]`);
    }
    return tok;
  });

  return cleaned.join("").trim();
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

    const sanitizedContent = sanitizeTranscript(
      (currentEntry.content as string | null) || ""
    );

    const userContent = `
СЕГОДНЯШНЯЯ СЕССИЯ (анализируй ТОЛЬКО её):
${transformationBlock}
${aromaBlock}
${sensoryBlock}

Свободный поток клиента (после серверной очистки от артефактов Whisper; токены вида [?слово] — подозрительные, игнорируй их): ${sanitizedContent || "(пусто)"}
`;

    const systemPrompt = `Ты — высококлассный психотерапевт. Твой стиль — лаконичность, глубина, живой язык. Говоришь как человек с человеком, а не как нейросеть.

Контекст работы: отклик пользователя на эфирное масло «${oil.title}»${oil.focus ? ` (фокус: ${oil.focus})` : ""}.
Фоновая статистика (НЕ упоминай и не цитируй напрямую):
${statsBlock}

ПРАВИЛА СТИЛЯ:
- Не более 2–3 коротких, очень точных абзацев. Каждое слово на своём месте.
- НИКАКОГО «стиля нейросетей»: без списков, нумераций, заголовков, сухих выводов, фраз вроде «важно отметить», «таким образом», «в заключение».
- НИКАКОЙ ПОЭЗИИ и эзотерики. Запрещены образы вроде «лучи солнца», «искры», «свет внутри», «зима для дерева», «вселенная», «пламя души».
- Оперируй живыми психологическими понятиями: ресурс, границы, сопротивление, соматика, опора, бережность, восстановление, нагрузка.
- Обращайся на «ты» — тепло, по-человечески, без сюсюканья.

ЗАЩИТА ОТ АРТЕФАКТОВ:
- Игнорируй опечатки и шум диктофона Whisper (включая токены вида [?слово]). Не выдумывай людей, диагнозов и травм, если пользователь сам о них не сказал.

СОДЕРЖАНИЕ:
- Если пользователь болеет/истощён, отторжение тяжёлых ароматов трактуй как здоровую соматическую защиту: телу нужен покой, а не глубокая трансформация.
- Тягу к простым, свежим ароматам — как зрелый поиск базовой опоры.
- Отторжение масла нормализуй как сигнал личных границ.
- В конце — один заземляющий вопрос для саморефлексии (без подписи «вопрос», просто сам вопрос).

ЦИТАТА ДЛЯ КАРТОЧКИ (shareQuote) — ЖЁСТКИЕ ТРЕБОВАНИЯ:
- Ёмкая терапевтическая мысль — рефрейминг, который возвращает человеку опору.
- Длина: СТРОГО 8–15 слов. Одно предложение (можно два очень коротких).
- Ясная психологическая констатация: о праве на отдых, о границах, о ресурсе, о бережности, о сопротивлении как защите.
- ЗАПРЕЩЕНО:
  • поэзия и образы природы/света («свет», «тьма», «лучи», «искра», «горечь», «вселенная», «солнце», «звезда», «огонь», «пламя»);
  • обращения и приказы: «помни», «знай», «ты достоин/достойна», «доверься», «отпусти», «не бойся», «люби себя», «верь в себя»;
  • мотивационные клише: «путь к себе», «лучшая версия себя», «вселенная даст», «всё будет хорошо», «слушай сердце», «счастье внутри», «жизнь прекрасна», «время лечит», «зона комфорта»;
  • прямые упоминания масла, аромата, эфира, практики, дневника, инсайта;
  • вопросы, многоточия в конце, эмодзи, хэштеги, кавычки, скобки, подписи.

ФОРМАТ ОТВЕТА (СТРОГО):
Сначала — чистый текст инсайта (2–3 коротких абзаца, без заголовков и скобок).
Затем — на отдельной строке маркер:
---SHARE_QUOTE---
И сразу после маркера — сама цитата (без кавычек, без скобок, без подписей).

Никакого текста до инсайта, никаких пояснений после цитаты.`;

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const OPENAI_BASE_URL = Deno.env.get("OPENAI_BASE_URL");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const useOpenAI = !!(OPENAI_API_KEY && OPENAI_BASE_URL);
    const aiKey = useOpenAI ? OPENAI_API_KEY : LOVABLE_API_KEY;
    const aiUrl = useOpenAI
      ? `${OPENAI_BASE_URL!.replace(/\/+$/, "")}/chat/completions`
      : "https://ai.gateway.lovable.dev/v1/chat/completions";

    // ProxyAPI: основной — Claude 3.5 Sonnet, фолбэк — Claude 3 Haiku.
    // Для Lovable AI Gateway оставляем Gemini как разумный дефолт.
    const PRIMARY_MODEL = useOpenAI ? "claude-3.5-sonnet" : "google/gemini-3-flash-preview";
    const FALLBACK_MODEL = useOpenAI ? "claude-3-haiku" : "google/gemini-2.5-flash-lite";
    const MAX_TOKENS = 450;

    if (!aiKey) {
      return new Response(JSON.stringify({ error: "AI ключ не настроен" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callAI = async (model: string) =>
      fetch(aiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_TOKENS,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      });

    let aiResponse = await callAI(PRIMARY_MODEL);
    let aiModel = PRIMARY_MODEL;

    // Фолбэк на Haiku при ошибках сервиса/таймаутах/перегрузках.
    if (!aiResponse.ok && aiResponse.status !== 429 && aiResponse.status !== 402) {
      console.warn(`Primary model ${PRIMARY_MODEL} failed (${aiResponse.status}), falling back to ${FALLBACK_MODEL}`);
      try {
        const fallbackResp = await callAI(FALLBACK_MODEL);
        if (fallbackResp.ok) {
          aiResponse = fallbackResp;
          aiModel = FALLBACK_MODEL;
        }
      } catch (fallbackErr) {
        console.error("Fallback model call failed:", fallbackErr);
      }
    }

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

    // Strip any stray bracketed instructions/headers that the model might leak
    const cleanLeakedFormatting = (s: string): string => {
      if (!s) return s;
      let out = s;
      // Remove [ ... ] blocks that look like instructions/placeholders
      out = out.replace(/\[[^\]\n]{0,200}\]/g, "");
      // Remove internal headers like "Отражение:", "Смысл аромата:", "Вопрос-якорь:", "Полный инсайт..."
      out = out.replace(
        /^\s*(?:\d+[.)]\s*)?(Отражение|Смысл аромата|Вопрос[\s\u2010-\u2015-]?якорь|Полный инсайт|Инсайт|Цитата)\s*[:：—-].*$/gim,
        ""
      );
      // Drop wrapping quotes around the whole share quote
      out = out.replace(/^\s*[«"“”']+|[«"“”']+\s*$/g, "");
      // Collapse excessive blank lines
      out = out.replace(/\n{3,}/g, "\n\n").trim();
      return out;
    };

    // Parse dual output
    let insightText = rawText;
    let shareQuote: string | null = null;
    const marker = "---SHARE_QUOTE---";
    if (rawText.includes(marker)) {
      const parts = rawText.split(marker);
      insightText = parts[0].trim();
      shareQuote = parts[1].trim();
    }

    insightText = cleanLeakedFormatting(insightText);
    if (shareQuote) shareQuote = cleanLeakedFormatting(shareQuote);

    // ---------- Валидация shareQuote: длина 8–15 слов + анти-банальность ----------
    const BANAL_PATTERNS: RegExp[] = [
      // Прямые обращения и приказы
      /\bпомни[,\s]/i, /\bзнай[,\s]/i, /\bпойми[,\s]/i, /\bпозволь\s+себе\b/i,
      /\bотпусти\b/i, /\bприми\s+себя\b/i, /\bбудь\s+собой\b/i,
      /\bдоверься\b/i, /\bне\s+бойся\b/i, /\bне\s+спеши\b/i, /\bдыши\s+глубже\b/i,
      /\bслушай\s+(сердце|себя|душу|тело|интуици)/i,
      /\bиди\s+(за\s+мечтой|вперёд|своим\s+путём)\b/i,
      // «Ты — …», «ты достоин/можешь/прекрасна»
      /\bты\s+(достойн|можешь|особенн|прекрасн|сильн|уникальн|важн|ценн|совершенн)/i,
      /\bты\s+—?\s*(свет|любовь|чудо|вселенная|целая\s+вселенная|солнце|звезда)\b/i,
      /\bвер(ь|ить)\s+в\s+себя\b/i,
      /\bлюби\s+себя\b/i,
      // Готовые мотивационные штампы
      /\bвсё\s+будет\s+хорошо\b/i,
      /\bвсё\s+не\s+случайно\b/i,
      /\bвсё\s+(в\s+твоих\s+руках|приходит\s+вовремя|идёт\s+по\s+плану)\b/i,
      /\bпуть\s+к\s+себе\b/i,
      /\bлучшая\s+версия\s+себя\b/i,
      /\bвыйти\s+из\s+зоны\s+комфорта\b/i,
      /\bжизнь\s+(коротка|прекрасна|—?\s*это\s+путешествие)\b/i,
      /\bсчастье\s+(внутри|—?\s*это\s+путь|—?\s*это\s+выбор)\b/i,
      /\bкаждый\s+(день|момент)\s+—?\s*(дар|чудо|новая\s+жизнь)\b/i,
      /\bвремя\s+лечит\b/i,
      /\bвсё,?\s+что\s+нужно,?\s+уже\s+есть\b/i,
      /\bвселенная\s+(даст|услышит|подскажет|поддержит|на\s+твоей\s+стороне)/i,
      /\bблагодарность\s+открывает\b/i,
      /\bсвет\s+внутри\s+тебя\b/i,
      // Поэтические/эзотерические образы (новая жёсткая отбраковка)
      /\b(лучи?\s+солнца|солнечн(ый|ая|ые)\s+луч)/i,
      /\bискр[аыуои]\b/i,
      /\bпламя\s+(души|сердца|жизни)\b/i,
      /\bгоречь\s+(лечит|исцеляет|—?\s*это)/i,
      /\b(тьма|темнота)\s+(уходит|отступает|становится)/i,
      /\bсвет\s+(во\s+тьме|пробивается|ведёт|внутри|освещает)/i,
      /\bвселенн(ая|ой|ую)\b/i,
      // Запрещённые предметы темы
      /\b(масл[оае]|аромат|эфир|практик|дневник|инсайт)/i,
    ];
    const countWords = (s: string) =>
      (s.match(/[\p{L}\p{N}'_-]+/gu) || []).length;

    // Пустые абстракции — слова без конкретного образа/чувственной фактуры.
    // Если 3+ таких в короткой цитате и при этом нет ни одного «образного якоря»
    // (конкретный предмет/природа/тело/действие), считаем псевдоафоризмом.
    const ABSTRACT_WORDS = [
      "любовь","свет","тьма","темнота","горечь","лучи","луч","искра","искры",
      "вселенная","душа","сердце","путь","жизнь","счастье","гармония",
      "истина","правда","смысл","сила","свобода","вечность","бесконечность",
      "энергия","поток","сознание","дух","тишина","покой","мир","единство",
      "целостность","принятие","осознанность","присутствие","настоящее",
      "момент","реальность","пространство","время","судьба","предназначение",
      "красота","мудрость","благодать","любить","чувствовать","быть",
    ];
    const CONCRETE_WORDS = [
      // природа
      "дерево","корень","ветка","лист","трава","цветок","лепесток","роса","дождь",
      "снег","ветер","туман","море","река","волна","камень","песок","земля","глина",
      "уголь","зола","дым","пепел",
      "небо","облако","рассвет","закат","ночь","утро",
      // тело и жесты
      "ладонь","рука","палец","плечо","спина","грудь","горло","живот","колено","стопа",
      "кожа","дыхание","вдох","выдох","шёпот","голос","слеза","улыбка","взгляд",
      // предметы
      "нить","ткань","ваза","чаша","свеча","зеркало","окно","дверь","ключ","нож",
      "хлеб","вода","соль","мёд","вино","чай","книга","письмо","часы","мост","дом",
      // действия
      "держать","нести","ронять","ловить","шить","резать","зажигать","гасить",
      "наливать","разливать","сажать","расти","цвести","трескаться","ломаться","гореть",
    ];
    const tokenize = (s: string): string[] =>
      (s.toLowerCase().match(/[\p{L}]+/gu) || []);
    const hasStem = (tokens: string[], stems: string[]) =>
      tokens.some((t) => stems.some((st) => t.startsWith(st.slice(0, Math.max(4, st.length - 1)))));
    const countStems = (tokens: string[], stems: string[]) =>
      tokens.reduce(
        (acc, t) => acc + (stems.some((st) => t.startsWith(st.slice(0, Math.max(4, st.length - 1)))) ? 1 : 0),
        0,
      );

    const isQuoteValid = (q: string | null): { ok: boolean; reason?: string } => {
      if (!q) return { ok: false, reason: "empty" };
      const trimmed = q.trim();
      if (!trimmed) return { ok: false, reason: "empty" };
      if (/[?]\s*$/.test(trimmed)) return { ok: false, reason: "question" };
      if (/[#@]/.test(trimmed)) return { ok: false, reason: "hashtag" };
      if (/\.{3,}|…/.test(trimmed)) return { ok: false, reason: "ellipsis" };
      if (/["“”«»]/.test(trimmed)) return { ok: false, reason: "quotes" };
      const wc = countWords(trimmed);
      if (wc < 8 || wc > 15) return { ok: false, reason: `length:${wc}` };
      for (const re of BANAL_PATTERNS) {
        if (re.test(trimmed)) return { ok: false, reason: `banal:${re}` };
      }
      // Псевдоафоризм: много абстракций и ни одного конкретного образа
      const tokens = tokenize(trimmed);
      const abstractCount = countStems(tokens, ABSTRACT_WORDS);
      const hasConcrete = hasStem(tokens, CONCRETE_WORDS);
      if (abstractCount >= 3 && !hasConcrete) {
        return { ok: false, reason: `pseudo:abstract=${abstractCount}` };
      }
      // Слишком много общих абстракций даже при наличии образа
      if (abstractCount >= 5) {
        return { ok: false, reason: `pseudo:overabstract=${abstractCount}` };
      }
      // Тавтология вида «X есть X» / «X — это X»
      if (/\b(\p{L}{4,})\b[^\p{L}]+(?:есть|это|—)[^\p{L}]+\1\b/iu.test(trimmed)) {
        return { ok: false, reason: "tautology" };
      }
      return { ok: true };
    };

    let quoteCheck = isQuoteValid(shareQuote);
    if (!quoteCheck.ok) {
      console.log("shareQuote invalid, regenerating. reason:", quoteCheck.reason, "quote:", shareQuote);
      try {
        const retryResp = await fetch(aiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${aiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: aiModel,
            messages: [
              {
                role: "system",
                content:
                  "Ты — глубокий и заземлённый психотерапевт. Выдели из инсайта одну сильную, терапевтичную мысль (рефрейминг), которая вернёт человеку опору. " +
                  "Никакой поэзии и абстракций. Только ясная психологическая констатация о границах, праве на отдых или ресурсе. " +
                  "Строго 8–15 слов. Без вопросов. " +
                  "ЗАПРЕЩЕНЫ: поэтические образы и эзотерика («свет», «тьма», «лучи», «искра», «горечь», «вселенная», «солнце», «звезда», «огонь», «пламя»), " +
                  "обращения и приказы («помни», «знай», «ты достоин», «доверься», «отпусти», «люби себя», «верь в себя»), " +
                  "мотивационные клише («путь к себе», «лучшая версия», «вселенная даст», «всё будет хорошо», «слушай сердце», «счастье внутри», «жизнь прекрасна», «время лечит», «зона комфорта»), " +
                  "тавтологии вида «X есть X», упоминания масла/аромата/практики/дневника, многоточия, эмодзи, хэштеги, кавычки, подписи. " +
                  "Можно одно слово в _подчёркиваниях_. Верни ТОЛЬКО саму цитату — без пояснений.",
              },
              {
                role: "user",
                content: `Инсайт:\n${insightText}\n\nСформулируй терапевтичную мысль по правилам.`,
              },
            ],
            temperature: 0.7,
          }),
        });
        if (retryResp.ok) {
          const retryData: any = await retryResp.json();
          const retryQuote = cleanLeakedFormatting(
            (retryData.choices?.[0]?.message?.content || "").trim()
          );
          const retryCheck = isQuoteValid(retryQuote);
          if (retryCheck.ok) {
            shareQuote = retryQuote;
            quoteCheck = retryCheck;
          } else {
            console.log("retry shareQuote still invalid:", retryCheck.reason, retryQuote);
            // Если всё ещё длинно — мягко обрежем до 15 слов как последний шанс
            if (retryQuote && /^length:\d+$/.test(retryCheck.reason || "")) {
              const wc = countWords(retryQuote);
              if (wc > 15) {
                const words = retryQuote.match(/\S+/g) || [];
                shareQuote = words.slice(0, 15).join(" ").replace(/[,;:]+$/, "") + ".";
              } else if (countWords(shareQuote || "") >= 8) {
                // оставляем исходный
              } else {
                shareQuote = retryQuote || shareQuote;
              }
            } else {
              shareQuote = retryQuote || shareQuote;
            }
          }
        }
      } catch (retryErr) {
        console.error("shareQuote retry failed:", retryErr);
      }
    }
    // ----------------------------------------------------------------------------

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
