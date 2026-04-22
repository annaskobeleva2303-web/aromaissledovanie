import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar } from "@/components/ui/calendar";
import { format, isToday } from "date-fns";
import { ru } from "date-fns/locale";
import { DiaryForm } from "@/components/DiaryForm";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionDetailModal } from "@/components/SessionDetailModal";
import { AnimatePresence } from "framer-motion";
import type { DayContentProps } from "react-day-picker";
import { getEmojiForState } from "@/lib/stateEmojis";

interface DiaryCalendarProps {
  oilId: string;
  viewOnly?: boolean;
}

export function DiaryCalendar({ oilId, viewOnly = false }: DiaryCalendarProps) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [viewingEntry, setViewingEntry] = useState<any | null>(null);

  const { data: entries = [] } = useQuery({
    queryKey: ["entries", oilId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("id, date, mood, content, created_at, energy_tags, energy_before, energy_after, mood_score_before, mood_score_after, record_type, oil_body_location, oil_sensation, oil_visual_image")
        .eq("oil_id", oilId)
        .eq("user_id", user!.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch AI insights keyed by created_at date
  const { data: insightsByDate = {} } = useQuery({
    queryKey: ["ai-insights-by-date", oilId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_insights")
        .select("content, share_quote, created_at")
        .eq("oil_id", oilId)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (!data) return {};
      // Map by date (yyyy-MM-dd)
      const map: Record<string, { content: string; share_quote: string | null }> = {};
      for (const row of data) {
        const d = row.created_at.slice(0, 10);
        if (!map[d]) map[d] = { content: row.content, share_quote: row.share_quote };
      }
      return map;
    },
    enabled: !!user,
  });

  const entryDates = new Set(entries.map((e) => e.date));
  const entryByDate = new Map(entries.map((e) => [e.date, e]));

  // Auto-show entry when entries load and selected date has one
  useEffect(() => {
    if (selectedDate && entries.length > 0) {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const entry = entryByDate.get(dateStr);
      if (entry && !viewingEntry) {
        setViewingEntry(entry);
      }
    }
  }, [entries, selectedDate]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      // Re-clicking same date in single mode deselects — re-select it instead
      if (selectedDate) {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const entry = entryByDate.get(dateStr);
        if (entry) setViewingEntry(entry);
      }
      return;
    }
    setSelectedDate(date);
    const dateStr = format(date, "yyyy-MM-dd");
    const entry = entryByDate.get(dateStr);
    if (entry) {
      setViewingEntry(entry);
    } else {
      setViewingEntry(null);
    }
  };

  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const showForm = !viewingEntry && selectedDate && !entryDates.has(selectedDateStr);
  const isTodaySelected = selectedDate ? isToday(selectedDate) : false;
  const hasEntryToday = entryDates.has(format(new Date(), "yyyy-MM-dd"));

  // Find insight for viewed entry
  const entryInsight = viewingEntry ? insightsByDate[viewingEntry.date] || null : null;

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
              const moodEmoji = entry?.mood ? getEmojiForState(entry.mood) : null;
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

      {/* Session detail view */}
      <AnimatePresence mode="wait">
        {viewingEntry && (
          <SessionDetailModal
            entry={viewingEntry}
            insight={entryInsight}
            onClose={() => setViewingEntry(null)}
          />
        )}
      </AnimatePresence>

      {/* Back to today button */}
      {viewingEntry && !isTodaySelected && !hasEntryToday && (
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
      )}

      {/* New entry form */}
      {showForm && !viewOnly && (
        <DiaryForm
          oilId={oilId}
          date={selectedDateStr}
          onSaved={() => {
            // Don't set viewingEntry immediately — let user navigate via calendar
            // Just refetch entries so the calendar shows the new entry marker
          }}
        />
      )}
    </div>
  );
}
