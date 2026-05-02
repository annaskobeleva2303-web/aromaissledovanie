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
    const openaiBaseUrl = (Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1").replace(/\/$/, "");
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

    const { name: outName, type: outType } = pickFilenameAndType(contentType, originalName);
    const outBlob = new Blob([await processed.arrayBuffer()], { type: outType });

    const outForm = new FormData();
    outForm.append("file", outBlob, outName);
    outForm.append("model", "whisper-1");
    outForm.append("language", language);
    outForm.append("response_format", "json");

    const whisperRes = await fetch(`${openaiBaseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
      },
      body: outForm,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error("Whisper error", whisperRes.status, errText, { sentAs: outName, type: outType });
      return new Response(
        JSON.stringify({ error: "Ошибка транскрибации", status: whisperRes.status, details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await whisperRes.json();
    return new Response(JSON.stringify({ text: data.text ?? "" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("transcribe-audio error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
