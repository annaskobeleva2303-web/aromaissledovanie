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
    <div className="space-y-8">
      {/* Mood picker */}
      <div className="glass-card p-6">
        <p className="mb-4 font-serif text-sm font-medium tracking-wide text-muted-foreground">
          Как вы себя чувствуете?
        </p>
        <div className="flex flex-wrap gap-2.5">
          {MOODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMood(mood === m.value ? null : m.value)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm transition-all duration-300 ${
                mood === m.value
                  ? "bg-primary text-primary-foreground shadow-md -translate-y-0.5"
                  : "bg-white/60 text-foreground/70 hover:bg-white hover:-translate-y-0.5 hover:shadow-sm"
              }`}
            >
              <span>{m.emoji}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content textarea — luxury notebook feel */}
      <div className="glass-card p-6">
        <p className="mb-4 font-serif text-sm font-medium tracking-wide text-muted-foreground">
          Ваш инсайт или наблюдение
        </p>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Опишите ваш опыт, ощущения, мысли…"
          className="min-h-[180px] resize-none rounded-2xl border-0 bg-white/40 px-5 py-4 text-sm leading-relaxed placeholder:text-muted-foreground/40 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>

      {/* Save */}
      <Button
        onClick={() => saveEntry()}
        disabled={!canSave || isPending}
        className="w-full rounded-full gap-2 py-6 text-sm tracking-wide transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
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
