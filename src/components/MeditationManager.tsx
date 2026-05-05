import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, Trash2, Headphones } from "lucide-react";
import { toast } from "sonner";
import { proxiedStorageUrl } from "@/lib/storageUrl";

interface OilLite {
  id: string;
  title: string;
}

interface OilMedia {
  id: string;
  oil_id: string;
  type: string;
  title: string;
  description: string | null;
  file_url: string;
  order_index: number;
  created_at: string;
}

export function MeditationManager() {
  const queryClient = useQueryClient();
  const [selectedOilId, setSelectedOilId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: oils = [] } = useQuery({
    queryKey: ["oils-for-media"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oils")
        .select("id, title")
        .eq("is_active", true)
        .order("title");
      if (error) throw error;
      return data as OilLite[];
    },
  });

  const { data: mediaList = [], isLoading } = useQuery({
    queryKey: ["oil_media", selectedOilId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oil_media")
        .select("*")
        .eq("oil_id", selectedOilId)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as OilMedia[];
    },
    enabled: !!selectedOilId,
  });

  const handleUpload = async () => {
    if (!selectedOilId) {
      toast.error("Выберите масло");
      return;
    }
    if (!file) {
      toast.error("Выберите аудиофайл");
      return;
    }
    if (!title.trim()) {
      toast.error("Введите название");
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "mp3").toLowerCase();
      const safeName = `${selectedOilId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("oil-media")
        .upload(safeName, file, { upsert: false, contentType: file.type || "audio/mpeg" });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("oil-media").getPublicUrl(safeName);
      const publicUrl = urlData.publicUrl;

      const nextOrder = (mediaList[mediaList.length - 1]?.order_index ?? -1) + 1;
      const { error: insErr } = await supabase.from("oil_media").insert({
        oil_id: selectedOilId,
        type: "meditation",
        title: title.trim(),
        description: description.trim() || null,
        file_url: publicUrl,
        order_index: nextOrder,
      });
      if (insErr) throw insErr;

      toast.success("Медитация загружена");
      setTitle("");
      setDescription("");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["oil_media", selectedOilId] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ошибка загрузки";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (item: OilMedia) => {
      // Try to remove file from storage (best-effort: extract path after bucket)
      try {
        const url = new URL(item.file_url);
        const marker = "/oil-media/";
        const idx = url.pathname.indexOf(marker);
        if (idx >= 0) {
          const path = url.pathname.slice(idx + marker.length);
          await supabase.storage.from("oil-media").remove([path]);
        }
      } catch {
        // ignore
      }
      const { error } = await supabase.from("oil_media").delete().eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Медитация удалена");
      queryClient.invalidateQueries({ queryKey: ["oil_media", selectedOilId] });
    },
    onError: () => toast.error("Ошибка удаления"),
  });

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs text-muted-foreground">Масло</Label>
        <Select value={selectedOilId} onValueChange={setSelectedOilId}>
          <SelectTrigger className="glass-card border-white/30 mt-1">
            <SelectValue placeholder="Выберите масло" />
          </SelectTrigger>
          <SelectContent>
            {oils.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedOilId && (
        <>
          <div className="space-y-3 rounded-2xl bg-white/20 backdrop-blur-sm p-4">
            <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Headphones className="h-3.5 w-3.5" /> Новая аудио-практика
            </h4>
            <div>
              <Label className="text-xs text-muted-foreground">Название *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: Вечерняя медитация"
                className="mt-1 bg-white/40 border-white/30 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Описание</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Краткое описание практики"
                className="mt-1 bg-white/40 border-white/30 text-sm resize-none"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Аудиофайл (mp3, wav, m4a)</Label>
              <label className="mt-1 flex items-center justify-center gap-2 cursor-pointer rounded-xl border border-dashed border-white/30 bg-white/20 hover:bg-white/30 transition-colors px-4 py-3 text-sm text-muted-foreground">
                <Upload className="h-4 w-4" />
                {file ? file.name : "Выбрать файл"}
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <Button
              onClick={handleUpload}
              disabled={uploading || !file || !title.trim()}
              className="w-full gap-2 rounded-xl bg-primary/90 hover:bg-primary"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Загрузка..." : "Загрузить медитацию"}
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Загруженные практики
            </h4>
            {isLoading && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isLoading && mediaList.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">Пока нет аудио-практик</p>
            )}
            {mediaList.map((m) => (
              <div
                key={m.id}
                className="flex items-start gap-2 rounded-xl bg-white/30 backdrop-blur-sm p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                  {m.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{m.description}</p>
                  )}
                  <audio
                    controls
                    src={proxiedStorageUrl(m.file_url)}
                    className="mt-2 w-full h-8"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => deleteMutation.mutate(m)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
