import { useEffect, useRef, useState } from "react";
import { Play, Pause, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { proxiedStorageUrl } from "@/lib/storageUrl";

interface OilAudioPlayerProps {
  title: string;
  description?: string | null;
  src: string;
}

function formatTime(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function OilAudioPlayer({ title, description, src }: OilAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(a.currentTime);
    const onLoaded = () => setDuration(a.duration || 0);
    const onPlay = () => { setPlaying(true); setLoading(false); };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    const onEnd = () => { setPlaying(false); setCurrent(0); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("durationchange", onLoaded);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("waiting", onWaiting);
    a.addEventListener("playing", onPlaying);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("durationchange", onLoaded);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("waiting", onWaiting);
      a.removeEventListener("playing", onPlaying);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      try {
        setLoading(true);
        await a.play();
      } catch {
        setLoading(false);
      }
    } else {
      a.pause();
    }
  };

  const seekFromEvent = (clientX: number) => {
    const el = progressRef.current;
    const a = audioRef.current;
    if (!el || !a || !duration) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    a.currentTime = ratio * duration;
    setCurrent(a.currentTime);
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-transparent backdrop-blur-2xl p-4 shadow-[inset_0_0_30px_rgba(139,92,246,0.08)]"
    >
      {/* soft glow */}
      <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-violet-400/20 blur-3xl" />

      <audio ref={audioRef} src={proxiedStorageUrl(src)} preload="metadata" />

      <div className="flex items-start gap-3 relative">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Пауза" : "Воспроизвести"}
          className="shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-violet-500/80 to-indigo-600/80 text-white shadow-[0_0_20px_6px_rgba(139,92,246,0.25)] hover:shadow-[0_0_24px_8px_rgba(139,92,246,0.4)] transition-shadow"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : playing ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 translate-x-[1px]" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-serif text-base text-foreground leading-tight truncate">{title}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
              {description}
            </p>
          )}

          <div
            ref={progressRef}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={duration || 0}
            aria-valuenow={current}
            className="mt-3 h-1.5 w-full rounded-full bg-white/15 cursor-pointer overflow-hidden"
            onClick={(e) => seekFromEvent(e.clientX)}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-400 to-indigo-300 shadow-[0_0_10px_rgba(167,139,250,0.6)] transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-1.5 flex items-center justify-between text-[10px] tabular-nums text-muted-foreground tracking-wider">
            <span>{formatTime(current)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
