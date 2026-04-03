import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const nudges = [
  { title: "🌙 Время для себя", message: "Ваши масла скучают. Самое время уделить 5 минут себе и своим ощущениям ✨" },
  { title: "📖 Дневник ждёт", message: "Как проходит ваше исследование сегодня? Дневник ждёт ваших новых открытий." },
  { title: "🌿 Маленькие шаги", message: "Маленькие шаги ведут к большим смыслам. Не забудьте зафиксировать ваше состояние сегодня 🌿" },
  { title: "✨ Момент осознанности", message: "Каждое наблюдение — это шаг к пониманию себя. Уделите пару минут своему дневнику сегодня." },
  { title: "💫 Ваш путь продолжается", message: "Практика — это не про идеальность, а про внимание к себе. Мы здесь, когда вы будете готовы." },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all users who have at least one entry
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id");

    if (usersError) throw usersError;

    let sentCount = 0;

    for (const user of users || []) {
      // Check last entry across all oils
      const { data: lastEntry } = await supabase
        .from("entries")
        .select("created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Skip users who never wrote anything or wrote recently
      if (!lastEntry) continue;
      const hoursSinceLastEntry = (Date.now() - new Date(lastEntry.created_at).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastEntry < 48) continue;

      // Check last reminder notification to avoid spamming (max once per 2 days)
      const { data: lastReminder } = await supabase
        .from("notifications")
        .select("created_at")
        .eq("user_id", user.id)
        .like("title", "%Время для себя%,Дневник ждёт%,Маленькие шаги%,Момент осознанности%,Ваш путь продолжается%")
        .order("created_at", { ascending: false })
        .limit(1);

      // More reliable: check any notification in last 2 days with our known titles
      const { data: recentReminders } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", user.id)
        .gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
        .in("title", nudges.map(n => n.title))
        .limit(1);

      if (recentReminders && recentReminders.length > 0) continue;

      // Pick a random nudge
      const nudge = nudges[Math.floor(Math.random() * nudges.length)];

      const { error: insertError } = await supabase
        .from("notifications")
        .insert({
          user_id: user.id,
          title: nudge.title,
          message: nudge.message,
          is_read: false,
        });

      if (!insertError) sentCount++;
    }

    return new Response(JSON.stringify({ success: true, sent: sentCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
