import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Trash2, Video, Save, Droplet } from "lucide-react";
import { toast } from "sonner";
import { useOils } from "@/hooks/useOils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const NO_OIL = "__none__";

export function MeetingArchiveManager() {
  const queryClient = useQueryClient();
  const { myOils, newOils } = useOils();
  const allOils = [...myOils, ...newOils];
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [oilId, setOilId] = useState<string>(NO_OIL);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["meeting_archive"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_archive" as any)
        .select("*")
        .order("meeting_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !meetingDate || !videoUrl.trim()) {
        throw new Error("Заполните все обязательные поля");
      }
      const { error } = await supabase.from("meeting_archive" as any).insert({
        title: title.trim(),
        meeting_date: meetingDate,
        video_url: videoUrl.trim(),
        description: description.trim() || null,
        oil_id: oilId === NO_OIL ? null : oilId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_archive"] });
      queryClient.invalidateQueries({ queryKey: ["meeting_archive_oil"] });
      queryClient.invalidateQueries({ queryKey: ["meeting_archive_public"] });
      toast.success("Мастер-класс добавлен!");
      setTitle("");
      setMeetingDate("");
      setVideoUrl("");
      setDescription("");
      setOilId(NO_OIL);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meeting_archive" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_archive"] });
      queryClient.invalidateQueries({ queryKey: ["meeting_archive_oil"] });
      queryClient.invalidateQueries({ queryKey: ["meeting_archive_public"] });
      toast.success("Мастер-класс удалён");
      setConfirmDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl bg-white/20 backdrop-blur-sm border border-white/20 p-3">
        <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Новый мастер-класс
        </h4>
        <div>
          <Label className="text-xs text-muted-foreground">Название *</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Глубокая работа с Лавандой"
            className="mt-1 bg-white/40 border-white/30 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Дата встречи *</Label>
          <Input
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            className="mt-1 bg-white/40 border-white/30 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Ссылка на видео (Iframe SRC) *</Label>
          <Input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://vk.com/video_ext.php?... или YouTube embed"
            className="mt-1 bg-white/40 border-white/30 text-sm"
          />
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            Для VK: используйте код вставки (Поделиться → Экспорт → src). Для YouTube: формат
            https://www.youtube.com/embed/...
          </p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Привязать к маслу</Label>
          <Select value={oilId} onValueChange={setOilId}>
            <SelectTrigger className="mt-1 bg-white/40 border-white/30 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_OIL}>Общий (для всех)</SelectItem>
              {allOils.map((oil) => (
                <SelectItem key={oil.id} value={oil.id}>
                  {oil.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            Если выбрано масло — видео появится внутри его карточки и в Медиатеке только у тех, у кого есть доступ.
          </p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Описание</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Краткое описание (необязательно)"
            className="mt-1 bg-white/40 border-white/30 text-sm resize-none"
          />
        </div>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || !title.trim() || !meetingDate || !videoUrl.trim()}
          className="w-full gap-2 rounded-xl bg-primary/90 hover:bg-primary"
        >
          {createMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Сохранить
        </Button>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Архив ({meetings.length})
        </h4>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : meetings.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">
            Пока нет добавленных мастер-классов.
          </p>
        ) : (
          <div className="space-y-2">
            {meetings.map((m) => (
              <div
                key={m.id}
                className="flex items-start justify-between gap-2 rounded-lg bg-white/40 backdrop-blur-sm px-3 py-2.5 border border-white/20"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                    <Video className="h-3.5 w-3.5 text-primary shrink-0" />
                    {m.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(m.meeting_date).toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs rounded-full text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => setConfirmDelete({ id: m.id, title: m.title })}
                  title="Удалить"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent className="glass-card border-white/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Удалить мастер-класс</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить «<strong>{confirmDelete?.title}</strong>»? Это действие
              необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) deleteMutation.mutate(confirmDelete.id);
              }}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
