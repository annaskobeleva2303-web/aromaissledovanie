import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar } from "@/components/ui/calendar";
import { format, isToday, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { DiaryForm } from "@/components/DiaryForm";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InsightShareCard } from "@/components/InsightShareCard";
import type { DayContentProps } from "react-day-picker";

const MOODS: Record<string, { label: string; emoji: string }> = {
  calm: { label: "Спокойно", emoji: "😌" },
  anxious: { label: "Тревожно", emoji: "😟" },
  joyful: { label: "Радостно", emoji: "😊" },
  sad: { label: "Грустно", emoji: "😢" },
  energetic: { label: "Энергично", emoji: "⚡" },
  irritated: { label: "Раздражённо", emoji: "😤" },
  reflective: { label: "Задумчиво", emoji: "🤔" },
  grateful: { label: "Благодарно", emoji: "🙏" },
};

interface DiaryCalendarProps {
  oilId: string;
}

export function DiaryCalendar({ oilId }: DiaryCalendarProps) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [viewingEntry, setViewingEntry] = useState<{
    content: string;
    mood: string | null;
    date: string;
    created_at: string;
  } | null>(null);

  const { data: entries = [] } = useQuery({
    queryKey: ["entries", oilId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("id, date, mood, content, created_at, energy_tags, energy_before, energy_after, mood_score_before, mood_score_after, record_type")
        .eq("oil_id", oilId)
        .eq("user_id", user!.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch latest AI insight for this oil
  const { data: latestInsight } = useQuery({
    queryKey: ["ai-insight-latest", oilId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_insights")
        .select("content, share_quote, created_at")
        .eq("oil_id", oilId)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Dates that have entries
  const entryDates = new Set(entries.map((e) => e.date));
  const entryByDate = new Map(entries.map((e) => [e.date, e]));

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    const dateStr = format(date, "yyyy-MM-dd");
    const entry = entryByDate.get(dateStr);
    if (entry) {
      setViewingEntry(entry);
    } else {
      setViewingEntry(null);
    }
  };

  const showForm = !viewingEntry && selectedDate;
  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const isTodaySelected = selectedDate ? isToday(selectedDate) : false;
  const hasEntryToday = entryDates.has(format(new Date(), "yyyy-MM-dd"));

  return (
    <div className="space-y-6">
      {/* Calendar */}
      <div className="glass-card p-4 flex justify-center">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          locale={ru}
          className="p-3 pointer-events-auto"
          classNames={{
            cell: "h-11 w-10 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
            day: "h-11 w-10 p-0 font-normal aria-selected:opacity-100 hover:bg-accent/50 rounded-xl transition-colors",
            head_cell: "text-muted-foreground rounded-md w-10 font-normal text-[0.8rem]",
            row: "flex w-full mt-1",
          }}
          disabled={(date) => date > new Date()}
          components={{
            DayContent: (props: DayContentProps) => {
              const dateStr = format(props.date, "yyyy-MM-dd");
              const entry = entryByDate.get(dateStr);
              const moodEmoji = entry?.mood && MOODS[entry.mood]?.emoji;
              const hasEnergy = entry?.energy_tags && Array.isArray(entry.energy_tags) && (entry.energy_tags as string[]).length > 0;

              return (
                <div className="relative flex flex-col items-center justify-center w-full h-full">
                  <span>{props.date.getDate()}</span>
                  {moodEmoji && (
                    <span className="absolute -bottom-0.5 text-[10px] leading-none">{moodEmoji}</span>
                  )}
                  {hasEnergy && !moodEmoji && entry && (
                    <span className="absolute bottom-0.5 w-1.5 h-1.5 rounded-full bg-primary/50" />
                  )}
                  {hasEnergy && moodEmoji && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-secondary/70" />
                  )}
                </div>
              );
            },
          }}
        />
      </div>

      {/* Selected date label */}
      {selectedDate && (
        <p className="text-center text-sm font-serif tracking-wide text-muted-foreground">
          {format(selectedDate, "d MMMM yyyy", { locale: ru })}
        </p>
      )}

      {/* Read-only entry view */}
      {viewingEntry && (
        <div className="space-y-4">
          <div className="glass-card p-6 space-y-4">
            {viewingEntry.mood && MOODS[viewingEntry.mood] && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-2 text-sm">
                <span>{MOODS[viewingEntry.mood].emoji}</span>
                <span className="text-foreground/80">{MOODS[viewingEntry.mood].label}</span>
              </div>
            )}
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {viewingEntry.content}
            </p>
          </div>

          {/* Share insight card for this entry */}
          {latestInsight?.content && (
            <InsightShareCard
              insightText={latestInsight.content}
              moodBefore={viewingEntry.mood || null}
              moodAfter={null}
              energyBefore={(viewingEntry as any).energy_before ?? null}
              energyAfter={(viewingEntry as any).energy_after ?? null}
            />
          )}

          {/* Back to form button — only if today doesn't have an entry yet */}
          {isTodaySelected ? null : !hasEntryToday ? (
            <Button
              variant="ghost"
              onClick={() => {
                setSelectedDate(new Date());
                setViewingEntry(null);
              }}
              className="w-full rounded-full gap-2 text-sm text-muted-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Вернуться к сегодня
            </Button>
          ) : null}
        </div>
      )}

      {/* New entry form */}
      {showForm && (
        <DiaryForm
          oilId={oilId}
          date={selectedDateStr}
          onSaved={() => {
            // After saving, switch to viewing the new entry
            const refetch = async () => {
              const { data } = await supabase
                .from("entries")
                .select("id, date, mood, content, created_at")
                .eq("oil_id", oilId)
                .eq("user_id", user!.id)
                .eq("date", selectedDateStr)
                .single();
              if (data) {
                setViewingEntry(data);
              }
            };
            refetch();
          }}
        />
      )}
    </div>
  );
}
