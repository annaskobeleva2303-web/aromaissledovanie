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

    // Accept multipart/form-data with `file` field
    const incomingForm = await req.formData();
    const file = incomingForm.get("file");
    if (!(file instanceof File) && !(file instanceof Blob)) {
      return new Response(JSON.stringify({ error: "Файл аудио не получен" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const language = (incomingForm.get("language") as string) || "ru";
    const filename = (file as File).name || "audio.webm";

    const outForm = new FormData();
    outForm.append("file", file, filename);
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
      console.error("Whisper error", whisperRes.status, errText);
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
