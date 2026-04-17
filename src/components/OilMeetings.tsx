import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Play, Video, X } from "lucide-react";

interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  video_url: string;
  description: string | null;
  oil_id: string | null;
}

interface OilMeetingsProps {
  oilId: string;
}

export function OilMeetings({ oilId }: OilMeetingsProps) {
  const [active, setActive] = useState<Meeting | null>(null);

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["meeting_archive_oil", oilId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_archive" as any)
        .select("*")
        .eq("oil_id", oilId)
        .order("meeting_date", { ascending: false });
      if (error) throw error;
      return data as unknown as Meeting[];
    },
    enabled: !!oilId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (meetings.length === 0) return null;

  return (
    <>
      <section className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Video className="h-4 w-4 text-primary" />
          <h3 className="font-serif text-base font-semibold text-foreground">
            Мастер-классы по этому маслу
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {meetings.map((m, idx) => (
            <motion.button
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              onClick={() => setActive(m)}
              className="group relative overflow-hidden rounded-2xl bg-white/30 backdrop-blur-md border border-white/30 text-left transition-all duration-300 hover:shadow-[0_8px_24px_rgba(139,92,246,0.2)] hover:-translate-y-0.5"
            >
              <div className="relative h-20 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-fuchsia-300/20 to-indigo-400/30" />
                <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-white/30 blur-2xl" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/50 backdrop-blur-md shadow-[0_0_16px_rgba(255,255,255,0.5)] transition-transform duration-300 group-hover:scale-110">
                    <Play className="h-4 w-4 text-violet-deep fill-violet-deep ml-0.5" />
                  </div>
                </div>
              </div>
              <div className="p-3">
                <p className="font-serif text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                  {m.title}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(m.meeting_date).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 sm:p-8"
            onClick={() => setActive(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="relative w-full max-w-5xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setActive(null)}
                className="absolute -top-12 right-0 sm:-top-2 sm:-right-12 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-md text-white hover:bg-white/25 transition-all duration-200"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="mb-3 px-1">
                <h2 className="font-serif text-lg sm:text-xl font-semibold text-white line-clamp-1">
                  {active.title}
                </h2>
                <p className="text-xs text-white/60 mt-0.5">
                  {new Date(active.meeting_date).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div
                className="relative w-full overflow-hidden rounded-2xl bg-black shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
                style={{ aspectRatio: "16 / 9" }}
              >
                <iframe
                  src={active.video_url}
                  className="absolute inset-0 h-full w-full"
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                  title={active.title}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
