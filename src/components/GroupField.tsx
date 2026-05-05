import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Users, Droplet, BarChart3, Sparkles, ChevronLeft, ChevronRight, RefreshCw, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { parseMoodPair, getEmojiForStateName } from "@/utils/stateUtils";

interface GroupStats {
  total_entries: number;
  unique_users: number;
  mood_counts: Record<string, number>;
  recent_days: { date: string; count: number }[];
}

interface GroupFieldProps {
  oilId: string;
}

export function GroupField({ oilId }: GroupFieldProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [trendIndex, setTrendIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingFinal, setIsGeneratingFinal] = useState(false);

  // Check if user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ["group-stats", oilId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_group_stats", {
        _oil_id: oilId,
      });
      if (error) throw error;
      return data as unknown as GroupStats;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: reports = [] } = useQuery({
    queryKey: ["group-reports", oilId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_reports")
        .select("id, report_type, period_start, period_end, report_text, created_at")
        .eq("oil_id", oilId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const finalReport = reports.find((r) => r.report_type === "final") ?? null;
  const weeklyReports = reports.filter((r) => r.report_type === "weekly");

  // Legacy fallback to old group_trends if no new reports yet
  const { data: legacyTrends = [] } = useQuery({
    queryKey: ["group-trends", oilId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_trends")
        .select("id, week_start, trend_text, created_at")
        .eq("oil_id", oilId)
        .order("week_start", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && reports.length === 0,
  });

  const weeklyList: { id: string; text: string; period_start: string; period_end: string | null }[] =
    weeklyReports.length > 0
      ? weeklyReports.map((r) => ({
          id: r.id,
          text: r.report_text,
          period_start: r.period_start,
          period_end: r.period_end,
        }))
      : legacyTrends.map((t) => ({
          id: t.id,
          text: t.trend_text,
          period_start: t.week_start,
          period_end: null,
        }));

  // Raw moods for accurate aggregation (handles new JSON before/after format)
  const { data: moodAggregation = {} } = useQuery({
    queryKey: ["group-mood-agg", oilId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("mood")
        .eq("oil_id", oilId)
        .not("mood", "is", null);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        const { after } = parseMoodPair(row.mood as string | null);
        for (const name of after) {
          if (!name) continue;
          counts[name] = (counts[name] ?? 0) + 1;
        }
      }
      return counts;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Public entries feed
  const { data: publicEntries = [] } = useQuery({
    queryKey: ["public-entries", oilId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("id, content, mood, date")
        .eq("oil_id", oilId)
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const handleGenerateTrend = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-group-trends", {
        body: { oilId },
      });
      if (error) throw error;
      toast.success("Групповой отчёт сгенерирован!");
      setTrendIndex(0);
      queryClient.invalidateQueries({ queryKey: ["group-reports", oilId] });
      queryClient.invalidateQueries({ queryKey: ["group-trends", oilId] });
    } catch (e) {
      console.error("Generate trend error:", e);
      toast.error("Не удалось сгенерировать отчёт");
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card p-12 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary/50" />
      </div>
    );
  }

  if (!stats || stats.total_entries === 0) {
    return (
      <div className="glass-card p-10 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Users className="h-6 w-6 text-primary" strokeWidth={1.5} />
        </div>
        <p className="font-serif text-lg font-medium tracking-wide text-foreground">
          Групповое поле пока пусто
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Когда участники начнут вести дневники, здесь появятся анонимные тренды и паттерны группы.
        </p>
      </div>
    );
  }

  const moodEntries = Object.entries(moodAggregation).sort(
    ([, a], [, b]) => b - a
  );
  const totalMoods = moodEntries.reduce((sum, [, count]) => sum + count, 0);
  const maxDayCount = Math.max(...stats.recent_days.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      {/* Stats overview */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          icon={<BarChart3 className="h-5 w-5 text-primary" strokeWidth={1.5} />}
          value={stats.total_entries}
          label="Записей всего"
        />
        <StatCard
          icon={<Users className="h-5 w-5 text-primary" strokeWidth={1.5} />}
          value={stats.unique_users}
          label={stats.unique_users === 1 ? "Участник" : stats.unique_users < 5 ? "Участника" : "Участников"}
        />
      </div>

      {/* Mood distribution */}
      {moodEntries.length > 0 && (
        <GlassSection>
          <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <IconBox><Droplet className="h-5 w-5 text-primary" strokeWidth={1.5} /></IconBox>
            <h3 className="font-serif text-lg font-semibold tracking-wide text-foreground">
              Эмоциональное поле группы
            </h3>
          </div>
          <div className="relative space-y-3">
            {moodEntries.map(([mood, count]) => {
              const emoji = getEmojiForStateName(mood);
              const percent = Math.round((count / totalMoods) * 100);
              return (
                <div key={mood} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-foreground/90">
                      <span className="text-base">{emoji}</span>
                      {mood}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">{percent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/40">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-700"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassSection>
      )}

      {/* Final report — pinned at top with golden glow */}
      {finalReport && (
        <div
          className="relative overflow-hidden rounded-3xl p-8 space-y-5"
          style={{
            background:
              "linear-gradient(135deg, hsla(45,80%,90%,0.55) 0%, hsla(35,70%,85%,0.45) 50%, hsla(25,80%,82%,0.4) 100%)",
            backdropFilter: "blur(24px)",
            boxShadow:
              "0 8px 50px hsla(38,90%,55%,0.18), 0 0 80px hsla(38,90%,55%,0.1), inset 0 1px 0 hsla(0,0%,100%,0.55)",
          }}
        >
          <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/25">
              <Sparkles className="h-5 w-5 text-amber-700" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700/80">
                Итог цикла
              </p>
              <h3 className="font-serif text-lg font-semibold tracking-wide text-foreground">
                Финальный отчёт Даваны
              </h3>
            </div>
          </div>
          <div className="relative text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {renderBoldText(finalReport.report_text)}
          </div>
          <p className="text-xs text-muted-foreground/60">
            Цикл с{" "}
            {new Date(finalReport.period_start).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
            {" "}по{" "}
            {new Date(finalReport.period_end).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
          </p>
        </div>
      )}

      {/* Weekly reports carousel */}
      {weeklyList.length > 0 && (
        <GlassSection glow>
          <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IconBox><Sparkles className="h-5 w-5 text-primary" strokeWidth={1.5} /></IconBox>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                  Неделя {weeklyList.length - trendIndex}
                </p>
                <h3 className="font-serif text-lg font-semibold tracking-wide text-foreground">
                  ИИ-обзор группы
                </h3>
                {weeklyList.length > 1 && (
                  <p className="text-xs text-muted-foreground/60">
                    {trendIndex + 1} из {weeklyList.length}
                  </p>
                )}
              </div>
            </div>
            {weeklyList.length > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTrendIndex((i) => Math.max(0, i - 1))}
                  disabled={trendIndex === 0}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setTrendIndex((i) => Math.min(weeklyList.length - 1, i + 1))}
                  disabled={trendIndex === weeklyList.length - 1}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          <div className="relative text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {renderBoldText(weeklyList[trendIndex].text)}
          </div>
          <p className="text-xs text-muted-foreground/60">
            Неделя с{" "}
            {new Date(weeklyList[trendIndex].period_start).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
            })}
          </p>
        </GlassSection>
      )}

      {/* Admin: manual report generation */}
      {isAdmin && (
        <div className="space-y-2">
          <Button
            variant="ghost"
            onClick={handleGenerateTrend}
            disabled={isGenerating || isGeneratingFinal}
            className="w-full rounded-full gap-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/20"
          >
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Сгенерировать недельный отчёт
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              setIsGeneratingFinal(true);
              try {
                const { data, error } = await supabase.functions.invoke("generate-final-report", { body: { oilId } });
                if (error) throw error;
                if ((data as any)?.status === "not_ready") {
                  toast.info((data as any).message ?? "Нужно 4 недельных отчёта");
                } else if ((data as any)?.status === "already_exists") {
                  toast.info("Итоговый отчёт уже существует");
                } else {
                  toast.success("Итоговый отчёт готов!");
                  queryClient.invalidateQueries({ queryKey: ["group-reports", oilId] });
                }
              } catch (e) {
                console.error(e);
                toast.error("Не удалось сгенерировать итоговый отчёт");
              } finally {
                setIsGeneratingFinal(false);
              }
            }}
            disabled={isGenerating || isGeneratingFinal}
            className="w-full rounded-full gap-2 text-xs text-amber-700 hover:text-amber-800 border border-dashed border-amber-400/30"
          >
            {isGeneratingFinal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Сгенерировать итоговый отчёт цикла
          </Button>
        </div>
      )}

      {/* Public entries feed */}
      {publicEntries.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-1">
            <MessageCircle className="h-5 w-5 text-primary/60" strokeWidth={1.5} />
            <h3 className="font-serif text-lg font-semibold tracking-wide text-foreground">
              Смыслы нашей группы
            </h3>
          </div>

          <div className="space-y-3">
            {publicEntries.map((entry) => {
              const { after } = parseMoodPair(entry.mood as string | null);
              const topMood = after[0] ?? null;
              const moodEmoji = topMood ? getEmojiForStateName(topMood) : null;
              return (
                <div
                  key={entry.id}
                  className="relative overflow-hidden rounded-2xl border border-white/20 p-5"
                  style={{
                    background: "hsla(0,0%,100%,0.35)",
                    backdropFilter: "blur(16px)",
                    boxShadow:
                      "0 4px 20px hsla(263,72%,52%,0.05), inset 0 1px 0 hsla(0,0%,100%,0.45)",
                  }}
                >
                  <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap pr-8">
                    {entry.content}
                  </p>
                  {moodEmoji && (
                    <span
                      className="absolute bottom-4 right-4 text-lg opacity-60"
                      title={topMood ?? undefined}
                    >
                      {moodEmoji}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Privacy note */}
      <p className="text-center text-xs text-muted-foreground/50">
        🔒 Все данные анонимны — видны только общие паттерны группы
      </p>
    </div>
  );
}

// --- Helpers ---

function renderBoldText(text: string) {
  return text.split(/(\*\*.*?\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-foreground">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function GlassSection({ children, glow }: { children: React.ReactNode; glow?: boolean }) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-white/25 p-8 space-y-5"
      style={{
        background:
          "linear-gradient(135deg, hsla(263,50%,92%,0.6) 0%, hsla(0,0%,100%,0.5) 50%, hsla(20,90%,88%,0.4) 100%)",
        backdropFilter: "blur(24px)",
        boxShadow: glow
          ? "0 8px 40px hsla(263,72%,52%,0.1), 0 0 60px hsla(263,72%,52%,0.05), inset 0 1px 0 hsla(0,0%,100%,0.5)"
          : "0 8px 40px hsla(263,72%,52%,0.1), inset 0 1px 0 hsla(0,0%,100%,0.5)",
      }}
    >
      {children}
    </div>
  );
}

function IconBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
      {children}
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/25 p-6 text-center space-y-2"
      style={{
        background: "hsla(0,0%,100%,0.45)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 4px 20px hsla(263,72%,52%,0.06), inset 0 1px 0 hsla(0,0%,100%,0.5)",
      }}
    >
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
        {icon}
      </div>
      <p className="text-2xl font-serif font-semibold tracking-wide text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
