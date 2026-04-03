import { Leaf, Lock, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Oil } from "@/hooks/useOils";

const RESEARCH_DAYS = 21;

interface OilCardProps {
  oil: Oil;
  locked?: boolean;
  daysCompleted?: number;
  onClick?: () => void;
}

export function OilCard({ oil, locked = false, daysCompleted = 0, onClick }: OilCardProps) {
  const progress = Math.min((daysCompleted / RESEARCH_DAYS) * 100, 100);
  const streakLabel = daysCompleted === 1 ? "день" : daysCompleted < 5 ? "дня" : "дней";

  return (
    <div
      className={`glass-card cursor-pointer overflow-hidden transition-all duration-300 ${
        locked
          ? "opacity-60 hover:opacity-75"
          : "hover:-translate-y-1 hover:shadow-[0_12px_40px_hsla(263,72%,52%,0.1)]"
      }`}
      onClick={onClick}
    >
      {oil.image_url && (
        <div className="relative h-40 w-full overflow-hidden">
          <img
            src={oil.image_url}
            alt={oil.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-white/20 to-transparent" />
        </div>
      )}
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              locked ? "bg-muted" : "bg-violet-glow"
            }`}
          >
            {locked ? (
              <Lock className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            ) : (
              <Leaf className="h-5 w-5 text-primary" strokeWidth={1.5} />
            )}
          </div>
          {oil.focus && (
            <Badge
              variant="secondary"
              className="rounded-full bg-coral-light/60 px-3 py-0.5 text-[10px] font-normal tracking-wide text-secondary-foreground border-0"
            >
              {oil.focus}
            </Badge>
          )}
        </div>

        <h3 className="mt-4 font-serif text-lg font-medium tracking-wide">
          {oil.title}
        </h3>

        {oil.description && (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {oil.description}
          </p>
        )}

        {!locked && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-secondary" strokeWidth={1.8} />
                {daysCompleted} {streakLabel} из {RESEARCH_DAYS}
              </span>
              <span className="font-medium text-primary">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1.5 bg-muted" />
          </div>
        )}

        {locked && (
          <p className="mt-3 text-xs text-muted-foreground/70 italic">
            Запросите доступ у администратора
          </p>
        )}
      </div>
    </div>
  );
}
  return (
    <div
      className={`glass-card cursor-pointer overflow-hidden transition-all duration-300 ${
        locked
          ? "opacity-60 hover:opacity-75"
          : "hover:-translate-y-1 hover:shadow-[0_12px_40px_hsla(263,72%,52%,0.1)]"
      }`}
      onClick={onClick}
    >
      {oil.image_url && (
        <div className="relative h-40 w-full overflow-hidden">
          <img
            src={oil.image_url}
            alt={oil.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-white/20 to-transparent" />
        </div>
      )}
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              locked ? "bg-muted" : "bg-violet-glow"
            }`}
          >
            {locked ? (
              <Lock className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            ) : (
              <Leaf className="h-5 w-5 text-primary" strokeWidth={1.5} />
            )}
          </div>
          {oil.focus && (
            <Badge
              variant="secondary"
              className="rounded-full bg-coral-light/60 px-3 py-0.5 text-[10px] font-normal tracking-wide text-secondary-foreground border-0"
            >
              {oil.focus}
            </Badge>
          )}
        </div>

        <h3 className="mt-4 font-serif text-lg font-medium tracking-wide">
          {oil.title}
        </h3>

        {oil.description && (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {oil.description}
          </p>
        )}

        {locked && (
          <p className="mt-3 text-xs text-muted-foreground/70 italic">
            Запросите доступ у администратора
          </p>
        )}
      </div>
    </div>
  );
}
