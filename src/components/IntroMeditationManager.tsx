import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";

const SETTING_KEY = "intro_meditation_url";

export function IntroMeditationManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [resetting, setResetting] = useState(false);

  const { data: setting, isLoading } = useQuery({
    queryKey: ["app_setting", SETTING_KEY],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", SETTING_KEY)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (setting?.value) setUrl(setting.value);
  }, [setting]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: SETTING_KEY, value: url.trim() || null, updated_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app_setting", SETTING_KEY] });
      queryClient.invalidateQueries({ queryKey: ["intro_meditation"] });
      toast.success("Настройки медитации сохранены");
    },
    onError: (e: Error) => toast.error("Ошибка: " + e.message),
  });

  const resetMyStatus = async () => {
    if (!user) return;
    setResetting(true);
    try {
      const { error } = await supabase
        .from("entries")
        .delete()
        .eq("user_id", user.id)
        .eq("record_type", "meditation_intro");
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["intro_meditation_done"] });
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      toast.success("Статус медитации сброшен — карточка появится снова");
    } catch (e: any) {
      toast.error("Ошибка: " + e.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white/20 backdrop-blur-sm border border-white/20 p-3 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> Вступительная медитация
        </h4>
        <div>
          <Label className="text-xs text-muted-foreground">URL медитации (VK Видео / YouTube / iframe src)</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://vk.com/video_ext.php?..."
            className="mt-1 bg-white/40 border-white/30 text-sm"
            disabled={isLoading}
          />
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Оставь поле пустым, чтобы скрыть карточку у всех пользователей.
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || isLoading}
          className="w-full gap-2 rounded-xl bg-primary/90 hover:bg-primary"
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Сохранить настройки
        </Button>
      </div>

      <div className="rounded-xl bg-white/20 backdrop-blur-sm border border-white/20 p-3 space-y-2">
        <p className="text-xs text-muted-foreground">
          Сбросить твой собственный статус прохождения, чтобы протестировать появление карточки.
        </p>
        <Button
          variant="outline"
          onClick={resetMyStatus}
          disabled={resetting}
          className="w-full gap-2 rounded-xl border-white/30 bg-white/30 hover:bg-white/40"
        >
          {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          Сбросить мой статус прохождения
        </Button>
      </div>
    </div>
  );
}
