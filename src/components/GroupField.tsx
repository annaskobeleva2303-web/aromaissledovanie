import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Users, TrendingUp, Droplet, BarChart3, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

const MOOD_MAP: Record<string, { label: string; emoji: string }> = {
  calm: { label: "Спокойно", emoji: "😌" },
  anxious: { label: "Тревожно", emoji: "😟" },
  joyful: { label: "Радостно", emoji: "😊" },
  sad: { label: "Грустно", emoji: "😢" },
  energetic: { label: "Энергично", emoji: "⚡" },
  irritated: { label: "Раздражённо", emoji: "😤" },
  reflective: { label: "Задумчиво", emoji: "🤔" },
  grateful: { label: "Благодарно", emoji: "🙏" },
};

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
        <div
          className="relative overflow-hidden rounded-3xl border border-white/25 p-8 space-y-5"
          style={{
            background:
              "linear-gradient(135deg, hsla(263,50%,92%,0.6) 0%, hsla(0,0%,100%,0.5) 50%, hsla(20,90%,88%,0.4) 100%)",
            backdropFilter: "blur(24px)",
            boxShadow:
              "0 8px 40px hsla(263,72%,52%,0.1), inset 0 1px 0 hsla(0,0%,100%,0.5)",
          }}
        >
          <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
              <Droplet className="h-5 w-5 text-primary" strokeWidth={1.5} />
            </div>
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
                    <span className="text-xs font-medium text-muted-foreground">
                      {percent}%
                    </span>
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
        </div>
      )}

      {/* Activity chart (last 14 days) */}
      {stats.recent_days.length > 0 && (
        <div
          className="relative overflow-hidden rounded-3xl border border-white/25 p-8 space-y-5"
          style={{
            background:
              "linear-gradient(135deg, hsla(263,50%,92%,0.6) 0%, hsla(0,0%,100%,0.5) 50%, hsla(20,90%,88%,0.4) 100%)",
            backdropFilter: "blur(24px)",
            boxShadow:
              "0 8px 40px hsla(263,72%,52%,0.1), inset 0 1px 0 hsla(0,0%,100%,0.5)",
          }}
        >
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
              <TrendingUp className="h-5 w-5 text-primary" strokeWidth={1.5} />
            </div>
            <h3 className="font-serif text-lg font-semibold tracking-wide text-foreground">
              Активность за 2 недели
            </h3>
          </div>

          <div className="relative flex items-end gap-1.5 h-24">
            {stats.recent_days.map((day) => {
              const height = Math.max(8, (day.count / maxDayCount) * 100);
              const date = new Date(day.date);
              const dayNum = date.getDate();
              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-primary/60 to-primary/30 transition-all duration-500"
                    style={{ height: `${height}%` }}
                    title={`${day.date}: ${day.count} записей`}
                  />
                  <span className="text-[9px] text-muted-foreground/50">
                    {dayNum}
                  </span>
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

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
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
      <p className="text-2xl font-serif font-semibold tracking-wide text-foreground">
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
