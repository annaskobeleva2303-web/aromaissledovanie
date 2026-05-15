import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Loader2, Play, Video, X } from "lucide-react";
import { SparkleBackground } from "@/components/SparkleBackground";
import BrandIcon from "@/components/BrandIcon";
import { toEmbedUrl } from "@/lib/videoEmbed";

interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  video_url: string;
  description: string | null;
  oil_id: string | null;
  oils?: { id: string; title: string } | null;
}

const VideoLibrary = () => {
  const navigate = useNavigate();
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  useEffect(() => {
    if (!activeMeeting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveMeeting(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeMeeting]);

  useEffect(() => {
    setIframeLoaded(false);
    setIframeError(false);
    if (!activeMeeting) return;
    const t = setTimeout(() => {
      setIframeLoaded((loaded) => {
        if (!loaded) setIframeError(true);
        return loaded;
      });
    }, 8000);
    return () => clearTimeout(t);
  }, [activeMeeting]);

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["meeting_archive_public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_archive" as any)
        .select("*, oils(id, title)")
        .order("meeting_date", { ascending: false });
      if (error) throw error;
      return data as unknown as Meeting[];
    },
  });

  return (
    <div className="min-h-screen relative">
      <SparkleBackground />

      <header className="sticky top-0 z-20 border-b border-white/20 bg-white/30 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="rounded-full text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <BrandIcon className="h-7 w-7" withBackground strokeWidth={1.8} />
            <span className="font-serif text-lg font-semibold text-violet-deep">Медиатека</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-8">
        <h1 className="mb-2 font-serif text-3xl font-semibold tracking-wide text-violet-deep">
          Мастер-классы
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Записи живых встреч и глубоких практик с маслами.
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : meetings.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <Video className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" strokeWidth={1.2} />
            <p className="text-sm text-muted-foreground">Архив пока пуст</p>
            <p className="mt-1.5 text-xs text-muted-foreground/60">
              Скоро здесь появятся записи мастер-классов
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {meetings.map((m, idx) => (
              <motion.button
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => setActiveMeeting(m)}
                className="group relative overflow-hidden rounded-3xl glass-card text-left transition-all duration-300 hover:shadow-[0_8px_32px_rgba(139,92,246,0.25)] hover:-translate-y-0.5"
              >
                {/* Abstract gradient background */}
                <div className="relative h-32 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-400/40 via-fuchsia-300/30 to-indigo-400/40" />
                  <div
                    className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/30 blur-2xl"
                    style={{ transform: `translate(${idx % 2 ? -10 : 10}px, 0)` }}
                  />
                  <div className="absolute bottom-0 left-0 h-20 w-20 rounded-full bg-primary/30 blur-2xl" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/40 backdrop-blur-md shadow-[0_0_24px_rgba(255,255,255,0.5)] transition-transform duration-300 group-hover:scale-110">
                      <Play className="h-6 w-6 text-violet-deep fill-violet-deep ml-0.5" />
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  {m.oils && (
                    <span className="inline-flex items-center rounded-full bg-primary/15 text-primary text-[10px] px-2 py-0.5 mb-2">
                      {m.oils.title}
                    </span>
                  )}
                  <p className="font-serif text-base font-semibold text-foreground line-clamp-2 leading-snug">
                    {m.title}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {new Date(m.meeting_date).toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  {m.description && (
                    <p className="mt-2 text-xs text-muted-foreground/80 line-clamp-2">
                      {m.description}
                    </p>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </main>

      {/* Video Player Modal */}
      <AnimatePresence>
        {activeMeeting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 sm:p-8"
            onClick={() => setActiveMeeting(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="relative w-full max-w-5xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setActiveMeeting(null)}
                className="absolute -top-12 right-0 sm:-top-2 sm:-right-12 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-md text-white hover:bg-white/25 transition-all duration-200"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Title */}
              <div className="mb-3 px-1">
                <h2 className="font-serif text-lg sm:text-xl font-semibold text-white line-clamp-1">
                  {activeMeeting.title}
                </h2>
                <p className="text-xs text-white/60 mt-0.5">
                  {new Date(activeMeeting.meeting_date).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>

              {/* 16:9 iframe container */}
              {(() => {
                const embed = toEmbedUrl(activeMeeting.video_url);
                const canEmbed = !!embed && embed !== activeMeeting.video_url;
                return (
                  <div className="relative w-full overflow-hidden rounded-2xl bg-black shadow-[0_20px_60px_rgba(0,0,0,0.5)]" style={{ aspectRatio: "16 / 9" }}>
                    {canEmbed && !iframeError && (
                      <iframe
                        src={embed}
                        onLoad={() => setIframeLoaded(true)}
                        onError={() => setIframeError(true)}
                        className="absolute inset-0 h-full w-full"
                        frameBorder={0}
                        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                        allowFullScreen
                        referrerPolicy="no-referrer"
                        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
                        title={activeMeeting.title}
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
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-violet-950/90 to-indigo-950/90 px-6 text-center">
                        <p className="text-sm text-white/80">
                          Не удалось встроить плеер в приложение.
                        </p>
                        <a
                          href={activeMeeting.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md px-5 py-2.5 text-sm text-white shadow-[0_0_24px_8px_rgba(167,139,250,0.3)] hover:bg-white/25 transition-all"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Открыть видео в новой вкладке
                        </a>
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="mt-3 text-center">
                <a
                  href={activeMeeting.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Открыть оригинальное видео ↗
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VideoLibrary;
