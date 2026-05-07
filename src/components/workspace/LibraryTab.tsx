import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Play, Video, X, BookOpen, Headphones, ExternalLink } from "lucide-react";
import { proxiedStorageUrl } from "@/lib/storageUrl";
import { OilAudioPlayer } from "@/components/OilAudioPlayer";
import { toEmbedUrl } from "@/lib/videoEmbed";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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

function PassportBlock({ value, title, text }: { value: string; title: string; text?: string | null }) {
  if (!text) return null;
  return (
    <AccordionItem value={value} className="border-b border-white/10 last:border-b-0">
      <AccordionTrigger className="py-3 hover:no-underline">
        <h4 className="font-serif text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground/70 text-left">
          {title}
        </h4>
      </AccordionTrigger>
      <AccordionContent>
        <p className="text-sm leading-relaxed text-foreground/75 whitespace-pre-line pt-1 pb-2">
          {text}
        </p>
      </AccordionContent>
    </AccordionItem>
  );
}

export function LibraryTab({ oil }: LibraryTabProps) {
  const [active, setActive] = useState<Meeting | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  const embedUrl = useMemo(() => (active ? toEmbedUrl(active.video_url) : ""), [active]);
  const canEmbed = !!active && !!embedUrl && embedUrl !== active.video_url;

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  useEffect(() => {
    setIframeLoaded(false);
    setIframeError(false);
    if (!active) return;
    const t = setTimeout(() => {
      setIframeLoaded((loaded) => {
        if (!loaded) setIframeError(true);
        return loaded;
      });
    }, 8000);
    return () => clearTimeout(t);
  }, [active]);

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
        <Accordion type="single" collapsible className="w-full">
          <PassportBlock value="description" title="О масле" text={oil.description} />
          <PassportBlock value="properties" title="Свойства" text={oil.properties} />
          <PassportBlock value="usage" title="Применение" text={oil.usage} />
          <PassportBlock value="cautions" title="Предостережения" text={oil.cautions} />
          <PassportBlock value="additional" title="Дополнительно" text={oil.additional_info} />
        </Accordion>
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
                {canEmbed && !iframeError && (
                  <iframe
                    src={embedUrl}
                    onLoad={() => setIframeLoaded(true)}
                    onError={() => setIframeError(true)}
                    className="absolute inset-0 h-full w-full"
                    frameBorder={0}
                    allow="autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write; gyroscope; accelerometer"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    title={active.title}
                  />
                )}
                {canEmbed && !iframeLoaded && !iframeError && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-900/50 via-indigo-900/40 to-fuchsia-900/50 animate-pulse" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(167,139,250,0.3),transparent_60%)] animate-pulse" />
                    <div className="relative flex flex-col items-center gap-2 text-white/80">
                      <Loader2 className="h-7 w-7 animate-spin" />
                      <span className="text-xs tracking-wide">Загружаем видео…</span>
                    </div>
                  </div>
                )}
                {(!canEmbed || iframeError) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-violet-950/80 to-indigo-950/80 px-6 text-center">
                    <p className="text-sm text-white/85">
                      Не удалось встроить плеер в приложение.
                    </p>
                    <a
                      href={active.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md px-5 py-2.5 text-sm text-white shadow-[0_0_20px_6px_rgba(167,139,250,0.25)] hover:bg-white/25 transition-all"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Открыть видео в новой вкладке
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
