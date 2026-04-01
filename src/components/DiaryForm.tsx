import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

const MOODS = [
  { value: "calm", label: "Спокойно", emoji: "😌" },
  { value: "anxious", label: "Тревожно", emoji: "😟" },
  { value: "joyful", label: "Радостно", emoji: "😊" },
  { value: "sad", label: "Грустно", emoji: "😢" },
  { value: "energetic", label: "Энергично", emoji: "⚡" },
  { value: "irritated", label: "Раздражённо", emoji: "😤" },
  { value: "reflective", label: "Задумчиво", emoji: "🤔" },
  { value: "grateful", label: "Благодарно", emoji: "🙏" },
];

interface DiaryFormProps {
  oilId: string;
}

export function DiaryForm({ oilId }: DiaryFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [mood, setMood] = useState<string | null>(null);
  const [content, setContent] = useState("");

  const { mutate: saveEntry, isPending } = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("entries").insert({
        user_id: user.id,
        oil_id: oilId,
        mood,
        content: content.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Запись сохранена ✨");
      setMood(null);
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["entries", oilId] });
    },
    onError: () => {
      toast.error("Не удалось сохранить запись");
    },
  });

  const canSave = content.trim().length > 0;

  return (
    <div className="space-y-5">
      {/* Mood picker */}
      <div>
        <p className="mb-2.5 text-sm font-medium text-muted-foreground">
          Как вы себя чувствуете?
        </p>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMood(mood === m.value ? null : m.value)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-all ${
                mood === m.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              <span>{m.emoji}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content textarea */}
      <div>
        <p className="mb-2.5 text-sm font-medium text-muted-foreground">
          Ваш инсайт или наблюдение
        </p>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Опишите ваш опыт, ощущения, мысли…"
          className="min-h-[140px] resize-none rounded-xl border-border/60 bg-card text-sm leading-relaxed placeholder:text-muted-foreground/50 focus-visible:ring-primary/30"
        />
      </div>

      {/* Save */}
      <Button
        onClick={() => saveEntry()}
        disabled={!canSave || isPending}
        className="w-full rounded-xl gap-2"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Сохранить запись
      </Button>
    </div>
  );
}
