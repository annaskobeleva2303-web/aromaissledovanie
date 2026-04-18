import { GroupField } from "@/components/GroupField";
import type { Oil } from "@/hooks/useOils";

interface FieldTabProps {
  oil: Oil;
}

export function FieldTab({ oil }: FieldTabProps) {
  return (
    <div className="space-y-6">
      <h2 className="font-serif text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Групповое поле
      </h2>
      <GroupField oilId={oil.id} />
    </div>
  );
}
