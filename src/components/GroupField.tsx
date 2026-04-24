import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Users, TrendingUp, Droplet, BarChart3, Sparkles, ChevronLeft, ChevronRight, RefreshCw, MessageCircle } from "lucide-react";
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

  const { data: trends = [] } = useQuery({
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
    enabled: !!user,
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
      const { data, error } = await supabase.functions.invoke("generate-group-trends");
      if (error) throw error;
      toast.success("Групповой тренд сгенерирован!");
      setTrendIndex(0);
      queryClient.invalidateQueries({ queryKey: ["group-trends", oilId] });
    } catch (e) {
      console.error("Generate trend error:", e);
      toast.error("Не удалось сгенерировать тренд");
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

  const moodEntries = Object.entries(stats.mood_counts).sort(
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
              const info = MOOD_MAP[mood];
              const percent = Math.round((count / totalMoods) * 100);
              return (
                <div key={mood} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-foreground/90">
                      <span className="text-base">{info?.emoji ?? "❓"}</span>
                      {info?.label ?? mood}
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

      {/* Activity chart */}
      {stats.recent_days.length > 0 && (
        <GlassSection>
          <div className="relative flex items-center gap-3">
            <IconBox><TrendingUp className="h-5 w-5 text-primary" strokeWidth={1.5} /></IconBox>
            <h3 className="font-serif text-lg font-semibold tracking-wide text-foreground">
              Активность за 2 недели
            </h3>
          </div>
          <div className="relative flex items-end gap-1.5 h-24">
            {stats.recent_days.map((day) => {
              const height = Math.max(8, (day.count / maxDayCount) * 100);
              const dayNum = new Date(day.date).getDate();
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-primary/60 to-primary/30 transition-all duration-500"
                    style={{ height: `${height}%` }}
                    title={`${day.date}: ${day.count} записей`}
                  />
                  <span className="text-[9px] text-muted-foreground/50">{dayNum}</span>
                </div>
              );
            })}
          </div>
        </GlassSection>
      )}

      {/* AI Group Trends */}
      {trends.length > 0 && (
        <GlassSection glow>
          <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IconBox><Sparkles className="h-5 w-5 text-primary" strokeWidth={1.5} /></IconBox>
              <div>
                <h3 className="font-serif text-lg font-semibold tracking-wide text-foreground">
                  ИИ-обзор недели
                </h3>
                {trends.length > 1 && (
                  <p className="text-xs text-muted-foreground/60">
                    {trendIndex + 1} из {trends.length}
                  </p>
                )}
              </div>
            </div>
            {trends.length > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTrendIndex((i) => Math.max(0, i - 1))}
                  disabled={trendIndex === 0}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setTrendIndex((i) => Math.min(trends.length - 1, i + 1))}
                  disabled={trendIndex === trends.length - 1}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          <div className="relative text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {renderBoldText(trends[trendIndex].trend_text)}
          </div>
          <p className="text-xs text-muted-foreground/60">
            Неделя с{" "}
            {new Date(trends[trendIndex].week_start).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
            })}
          </p>
        </GlassSection>
      )}

      {/* Admin: manual trend generation */}
      {isAdmin && (
        <Button
          variant="ghost"
          onClick={handleGenerateTrend}
          disabled={isGenerating}
          className="w-full rounded-full gap-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/20"
        >
          {isGenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Сгенерировать групповой тренд сейчас
        </Button>
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
              const moodInfo = entry.mood ? MOOD_MAP[entry.mood] : null;
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
                  {moodInfo && (
                    <span
                      className="absolute bottom-4 right-4 text-lg opacity-60"
                      title={moodInfo.label}
                    >
                      {moodInfo.emoji}
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
