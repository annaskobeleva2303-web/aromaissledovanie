import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Play, Video, X, BookOpen, Headphones } from "lucide-react";
import { proxiedStorageUrl } from "@/lib/storageUrl";
import { OilAudioPlayer } from "@/components/OilAudioPlayer";
interface OilFull {
  id: string;
  title: string;
  description: string | null;
  focus: string | null;
  image_url: string | null;
  properties?: string | null;
  usage?: string | null;
  cautions?: string | null;
  additional_info?: string | null;
}

interface LibraryTabProps {
  oil: OilFull;
}

interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  video_url: string;
  description: string | null;
  oil_id: string | null;
}

function PassportBlock({ title, text }: { title: string; text?: string | null }) {
  if (!text) return null;
  return (
    <div className="space-y-1.5">
      <h4 className="font-serif text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground/70">
        {title}
      </h4>
      <p className="text-sm leading-relaxed text-foreground/75 whitespace-pre-line">
        {text}
      </p>
    </div>
  );
}

export function LibraryTab({ oil }: LibraryTabProps) {
  const [active, setActive] = useState<Meeting | null>(null);

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["library_meetings", oil.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_archive" as any)
        .select("*")
        .or(`oil_id.eq.${oil.id},oil_id.is.null`)
        .order("meeting_date", { ascending: false });
      if (error) throw error;
      return data as unknown as Meeting[];
    },
  });

  const { data: mediaList = [] } = useQuery({
    queryKey: ["oil_media_public", oil.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oil_media")
        .select("id, title, description, file_url, order_index")
        .eq("oil_id", oil.id)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Array<{ id: string; title: string; description: string | null; file_url: string; order_index: number }>;
    },
  });

  return (
    <div className="space-y-8">
      {/* Паспорт масла */}
      <section className="glass-card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h2 className="font-serif text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Паспорт масла
          </h2>
        </div>
        {oil.image_url && (
          <div className="overflow-hidden rounded-2xl">
            <img src={proxiedStorageUrl(oil.image_url)} alt={oil.title} className="h-44 w-full object-cover" />
          </div>
        )}
        <div>
          <h3 className="font-serif text-2xl font-semibold tracking-wide text-violet-deep">
            {oil.title}
          </h3>
          {oil.focus && (
            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              {oil.focus}
            </p>
          )}
        </div>
        <div className="space-y-5">
          <PassportBlock title="О масле" text={oil.description} />
          <PassportBlock title="Свойства" text={oil.properties} />
          <PassportBlock title="Применение" text={oil.usage} />
          <PassportBlock title="Предостережения" text={oil.cautions} />
          <PassportBlock title="Дополнительно" text={oil.additional_info} />
        </div>
      </section>

      {/* Аудио-практики */}
      {mediaList.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Headphones className="h-4 w-4 text-primary" />
            <h2 className="font-serif text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Аудио-практики
            </h2>
          </div>
          <div className="space-y-3">
            {mediaList.map((m) => (
              <OilAudioPlayer
                key={m.id}
                title={m.title}
                description={m.description}
                src={m.file_url}
              />
            ))}
          </div>
        </section>
      )}

      {/* Мастер-классы */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Video className="h-4 w-4 text-primary" />
          <h2 className="font-serif text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Мастер-классы
          </h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : meetings.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Video className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" strokeWidth={1.2} />
            <p className="text-sm text-muted-foreground">Пока нет записей</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {meetings.map((m, idx) => (
              <motion.button
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                onClick={() => setActive(m)}
                className="group relative overflow-hidden rounded-3xl glass-card text-left transition-all duration-300 hover:shadow-[0_8px_28px_rgba(139,92,246,0.22)] hover:-translate-y-0.5"
              >
                <div className="relative h-28 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-400/40 via-fuchsia-300/30 to-indigo-400/40" />
                  <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-white/30 blur-2xl" />
                  <div className="absolute bottom-0 left-0 h-16 w-16 rounded-full bg-primary/30 blur-2xl" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/45 backdrop-blur-md shadow-[0_0_22px_rgba(255,255,255,0.5)] transition-transform duration-300 group-hover:scale-110">
                      <Play className="h-5 w-5 text-violet-deep fill-violet-deep ml-0.5" />
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  {m.oil_id === oil.id && (
                    <span className="inline-flex items-center rounded-full bg-primary/15 text-primary text-[10px] px-2 py-0.5 mb-1.5">
                      По этому маслу
                    </span>
                  )}
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
        )}
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
    </div>
  );
}
