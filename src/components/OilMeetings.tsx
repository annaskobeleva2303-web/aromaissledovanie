import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Play, Video, X } from "lucide-react";
import { toEmbedUrl } from "@/lib/videoEmbed";

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
  const [activeId, setActiveId] = useState<string | null>(null);

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
    <section className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Video className="h-4 w-4 text-primary" />
        <h3 className="font-serif text-base font-semibold text-foreground">
          Мастер-классы по этому маслу
        </h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {meetings.map((m, idx) => {
          const isActive = activeId === m.id;
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="group relative overflow-hidden rounded-2xl bg-white/30 backdrop-blur-md border border-white/30 text-left transition-all duration-300"
            >
              <AnimatePresence mode="wait" initial={false}>
                {isActive ? (
                  <motion.div
                    key="player"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="relative w-full bg-black" style={{ aspectRatio: "16 / 9" }}>
                      <iframe
                        src={toEmbedUrl(m.video_url)}
                        className="absolute inset-0 h-full w-full"
                        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                        allowFullScreen
                        title={m.title}
                      />
                      <button
                        onClick={() => setActiveId(null)}
                        className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70 transition-all"
                        aria-label="Закрыть плеер"
                      >
                        <X className="h-4 w-4" />
                      </button>
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
                  </motion.div>
                ) : (
                  <motion.button
                    key="cover"
                    type="button"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => setActiveId(m.id)}
                    className="block w-full text-left transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(139,92,246,0.2)]"
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
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
