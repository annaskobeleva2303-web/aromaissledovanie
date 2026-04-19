import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Pin } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface IntroMeditationCardProps {
  oilId: string;
}

export function IntroMeditationCard({ oilId }: IntroMeditationCardProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const { data: introEntry } = useQuery({
    queryKey: ["intro-meditation-entry", oilId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("id, content, created_at, date")
        .eq("oil_id", oilId)
        .eq("user_id", user!.id)
        .eq("record_type", "meditation_intro")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (!introEntry) return null;

  const dateFormatted = format(parseISO(introEntry.created_at), "d MMMM yyyy", { locale: ru });

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="relative w-full text-left rounded-3xl p-5 overflow-hidden bg-gradient-to-br from-primary/15 via-secondary/10 to-transparent backdrop-blur-2xl shadow-[0_0_40px_-10px_hsl(var(--primary)/0.4)] transition-shadow hover:shadow-[0_0_50px_-8px_hsl(var(--primary)/0.55)]"
      >
        <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-primary/70">
          <Pin className="h-3 w-3" />
          Закреплено
        </div>
        <div className="flex items-start gap-3 pr-16">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1.5 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Первое погружение · {dateFormatted}
            </p>
            <h3 className="font-serif text-lg leading-tight text-foreground">
              Встреча с маслом
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {introEntry.content}
            </p>
          </div>
        </div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl p-7 bg-gradient-to-br from-primary/15 via-secondary/10 to-background/80 backdrop-blur-2xl shadow-[0_0_60px_-10px_hsl(var(--primary)/0.5)]"
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-foreground/5 hover:bg-foreground/10 transition-colors"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-primary/80 mb-2">
                <Sparkles className="h-3.5 w-3.5" />
                Первое погружение
              </div>
              <h2 className="font-serif text-2xl leading-tight mb-1">
                Встреча с маслом
              </h2>
              <p className="text-xs text-muted-foreground mb-5">{dateFormatted}</p>

              <div className="rounded-2xl bg-background/40 p-4 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">
                {introEntry.content}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
