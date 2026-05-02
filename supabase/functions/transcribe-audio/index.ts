import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// WebM/Matroska files start with EBML signature: 0x1A 0x45 0xDF 0xA3
function isWebm(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  );
}

/**
 * Attempt to fix missing duration in WebM headers (common with MediaRecorder).
 * If the file is NOT a WebM (no EBML signature), return it unchanged so we
 * don't corrupt MP4/M4A/MPEG files coming from Safari / iOS / macOS.
 */
async function fixWebmDuration(file: Blob): Promise<Blob> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (!isWebm(buf)) {
    // Not a WebM — return as is.
    return file;
  }
  // No-op fix: we just pass the original buffer through. Whisper handles
  // streamed WebM without explicit duration in most cases. Kept as a hook
  // for future header patching without breaking other formats.
  return new Blob([buf], { type: file.type || "audio/webm" });
}

function pickFilenameAndType(contentType: string, originalName?: string): { name: string; type: string } {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("mp4") || ct.includes("m4a") || ct.includes("aac")) {
    return { name: "audio.m4a", type: "audio/mp4" };
  }
  if (ct.includes("mpeg") || ct.includes("mp3")) {
    return { name: "audio.mp3", type: "audio/mpeg" };
  }
  if (ct.includes("wav")) {
    return { name: "audio.wav", type: "audio/wav" };
  }
  if (ct.includes("ogg")) {
    return { name: "audio.ogg", type: "audio/ogg" };
  }
  if (ct.includes("webm")) {
    return { name: "audio.webm", type: "audio/webm" };
  }
  // Fallback: try to use original extension if present
  if (originalName && /\.(m4a|mp4|mp3|wav|ogg|webm)$/i.test(originalName)) {
    return { name: originalName, type: contentType || "application/octet-stream" };
  }
  return { name: "audio.webm", type: "audio/webm" };
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
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    // Изолированный стабильный endpoint для транскрибации через ProxyAPI.
    // Не зависит от OPENAI_BASE_URL, чтобы изменения для других функций
    // (например generate-insight) не ломали Whisper.
    const aiUrl = "https://api.proxyapi.ru/openai/v1/audio/transcriptions";
    console.log("Запрос транскрибации отправлен на:", aiUrl);
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY не настроен" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const incomingForm = await req.formData();
    const file = incomingForm.get("file");
    if (!(file instanceof File) && !(file instanceof Blob)) {
      return new Response(JSON.stringify({ error: "Файл аудио не получен" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const language = (incomingForm.get("language") as string) || "ru";
    const originalName = (file as File).name || "";
    const contentType = (file as File).type || "";

    console.log("transcribe-audio: incoming", { name: originalName, type: contentType, size: (file as File).size });

    // Only attempt WebM duration fix for actual WebM streams. For mp4/mpeg
    // and other formats we forward the raw bytes to OpenAI untouched.
    let processed: Blob = file as Blob;
    const ct = contentType.toLowerCase();
    const isLikelyWebm = ct.includes("webm") || (!ct && /\.webm$/i.test(originalName));
    if (isLikelyWebm) {
      try {
        processed = await fixWebmDuration(file as Blob);
      } catch (e) {
        console.warn("fixWebmDuration failed, sending original:", e);
        processed = file as Blob;
      }
    }

    const sourceBytes = new Uint8Array(await processed.arrayBuffer());

    // Build a primary attempt + fallback chain. Edge runtime has no ffmpeg,
    // so "auto-conversion" here means re-presenting the same bytes with
    // alternative container/extension hints that Whisper accepts. This
    // resolves cases where the device-reported MIME doesn't match the
    // actual stream (common on Mac/iOS/Android).
    const primary = pickFilenameAndType(contentType, originalName);

    const isWebmStream = isWebm(sourceBytes);
    const fallbacks: Array<{ name: string; type: string }> = [];
    if (isWebmStream) {
      // True WebM bytes — never relabel them as OGG/MP4 without real conversion.
      // ProxyAPI fails duration parsing when WebM bytes are sent as audio.ogg.
      if (primary.type !== "audio/webm") fallbacks.push({ name: "audio.webm", type: "audio/webm" });
    } else {
      // Likely MP4/M4A/MP3/WAV. Try common matching hints, but do not force OGG.
      const candidates: Array<{ name: string; type: string }> = [
        { name: "audio.m4a", type: "audio/mp4" },
        { name: "audio.mp4", type: "audio/mp4" },
        { name: "audio.mp3", type: "audio/mpeg" },
        { name: "audio.wav", type: "audio/wav" },
      ];
      for (const c of candidates) {
        if (c.name !== primary.name || c.type !== primary.type) fallbacks.push(c);
      }
    }

    const attempts = [primary, ...fallbacks];
    let lastErr: { status: number; details: string; sentAs: string; type: string } | null = null;

    const isFormatError = (status: number, details: string) => {
      if (status === 400 || status === 415) return true;
      const d = details.toLowerCase();
      return (
        d.includes("invalid file format") ||
        d.includes("could not be decoded") ||
        d.includes("unsupported") ||
        d.includes("unrecognized") ||
        d.includes("audio file") && d.includes("format")
      );
    };

    for (let i = 0; i < attempts.length; i++) {
      const { name, type } = attempts[i];
      const blob = new Blob([sourceBytes], { type });
      const form = new FormData();
      form.append("file", blob, name);
      form.append("model", "whisper-1");
      form.append("language", language);
      form.append("response_format", "json");

      console.log(`transcribe-audio: attempt ${i + 1}/${attempts.length}`, { name, type });

      const res = await fetch(aiUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: form,
      });

      if (res.ok) {
        const data = await res.json();
        if (i > 0) console.log(`transcribe-audio: succeeded on fallback as ${name} (${type})`);
        return new Response(JSON.stringify({ text: data.text ?? "" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const errText = await res.text();
      lastErr = { status: res.status, details: errText, sentAs: name, type };
      console.error(`Whisper attempt ${i + 1} failed`, res.status, errText, { sentAs: name, type });

      // Only retry with alternative format hints on format-related errors.
      if (!isFormatError(res.status, errText)) break;
    }

    return new Response(
      JSON.stringify({
        error: "Ошибка транскрибации",
        status: lastErr?.status ?? 502,
        details: lastErr?.details ?? "unknown",
        sentAs: lastErr?.sentAs,
        type: lastErr?.type,
      }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("transcribe-audio error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
