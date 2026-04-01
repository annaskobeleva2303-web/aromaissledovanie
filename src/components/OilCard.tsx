import { Leaf, Lock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Oil } from "@/hooks/useOils";

interface OilCardProps {
  oil: Oil;
  locked?: boolean;
  onClick?: () => void;
}

export function OilCard({ oil, locked = false, onClick }: OilCardProps) {
  return (
    <Card
      className={`group cursor-pointer transition-all duration-300 hover:shadow-md ${
        locked ? "opacity-70 hover:opacity-80" : "hover:-translate-y-0.5"
      }`}
      onClick={onClick}
    >
      <CardHeader className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            {locked ? (
              <Lock className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            ) : (
              <Leaf className="h-5 w-5 text-primary" strokeWidth={1.5} />
            )}
          </div>
          {oil.focus && (
            <Badge variant="secondary" className="text-[10px] font-normal">
              {oil.focus}
            </Badge>
          )}
        </div>

        <CardTitle className="mt-2 text-base leading-snug">{oil.title}</CardTitle>

        {oil.description && (
          <CardDescription className="line-clamp-2 text-xs">
            {oil.description}
          </CardDescription>
        )}

        {locked && (
          <p className="mt-1 text-[11px] text-muted-foreground italic">
            Запросите доступ у администратора
          </p>
        )}
      </CardHeader>
    </Card>
  );
}
