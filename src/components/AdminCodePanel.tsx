import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOils } from "@/hooks/useOils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, Loader2, KeyRound, Sparkles, Users, RotateCcw, BookOpen, Save, Upload, X, Plus, Trash2, Eraser, Video, Headphones } from "lucide-react";
import { MeetingArchiveManager } from "@/components/MeetingArchiveManager";
import { IntroMeditationManager } from "@/components/IntroMeditationManager";
import { MeditationManager } from "@/components/MeditationManager";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { proxiedStorageUrl } from "@/lib/storageUrl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

function CreateOilForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [focus, setFocus] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) { toast.error("Введите название масла"); return; }
    setCreating(true);
    try {
      const { error } = await supabase.from("oils").insert({ title: title.trim(), focus: focus.trim() || null });
      if (error) throw error;
      toast.success(`Масло "${title.trim()}" создано!`);
      setTitle("");
      setFocus("");
      onCreated();
    } catch (err: any) {
      toast.error("Ошибка: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl bg-white/20 backdrop-blur-sm border border-white/20 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        <Plus className="h-3.5 w-3.5" /> Новое масло
      </h4>
      <div>
        <Label className="text-xs text-muted-foreground">Название *</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Лаванда" className="mt-1 bg-white/40 border-white/30 text-sm" />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Фокус исследования</Label>
        <Input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Краткое описание фокуса" className="mt-1 bg-white/40 border-white/30 text-sm" />
      </div>
      <Button onClick={handleCreate} disabled={creating || !title.trim()} className="w-full gap-2 rounded-xl bg-primary/90 hover:bg-primary">
        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Создать масло
      </Button>
    </div>
  );
}

function OilEditor({ allOils }: { allOils: { id: string; title: string }[] }) {
  const queryClient = useQueryClient();
  const [selectedOilId, setSelectedOilId] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const { data: oilData, isLoading } = useQuery({
    queryKey: ["oil_edit", selectedOilId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oils")
        .select("*")
        .eq("id", selectedOilId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOilId,
  });

  const [form, setForm] = useState({
    description: "",
    properties: "",
    usage: "",
    cautions: "",
    additional_info: "",
    image_url: "",
  });

  // Sync form when oil loads
  const [lastLoadedId, setLastLoadedId] = useState("");
  if (oilData && oilData.id !== lastLoadedId) {
    setLastLoadedId(oilData.id);
    setForm({
      description: (oilData as any).description || "",
      properties: (oilData as any).properties || "",
      usage: (oilData as any).usage || "",
      cautions: (oilData as any).cautions || "",
      additional_info: (oilData as any).additional_info || "",
      image_url: (oilData as any).image_url || "",
    });
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedOilId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${selectedOilId}.${ext}`;
      await supabase.storage.from("oil-images").remove([path]);
      const { error: uploadError } = await supabase.storage
        .from("oil-images")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from("oil-images")
        .getPublicUrl(path);
      const publicUrl = urlData.publicUrl + "?t=" + Date.now();
      setForm((f) => ({ ...f, image_url: publicUrl }));
      toast.success("Изображение загружено!");
    } catch (err: any) {
      toast.error("Ошибка загрузки: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("oils")
        .update({
          description: form.description || null,
          image_url: form.image_url || null,
          ...({ properties: form.properties || null, usage: form.usage || null, cautions: form.cautions || null, additional_info: form.additional_info || null } as any),
        })
        .eq("id", selectedOilId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oil_edit", selectedOilId] });
      queryClient.invalidateQueries({ queryKey: ["oil"] });
      queryClient.invalidateQueries({ queryKey: ["oils"] });
      toast.success("Изменения сохранены!");
    },
    onError: () => toast.error("Ошибка сохранения"),
  });

  const handleOilCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["oils"] });
  };

  return (
    <div className="space-y-4">
      <CreateOilForm onCreated={handleOilCreated} />

      <div className="border-t border-white/20 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Редактирование</h4>
        <Select value={selectedOilId} onValueChange={(v) => { setSelectedOilId(v); setLastLoadedId(""); }}>
          <SelectTrigger className="glass-card border-white/30">
            <SelectValue placeholder="Выберите масло" />
          </SelectTrigger>
          <SelectContent>
            {allOils.map((oil) => (
              <SelectItem key={oil.id} value={oil.id}>{oil.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && selectedOilId && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {oilData && (
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Изображение</Label>
            {form.image_url && (
              <div className="relative mt-1 mb-2 rounded-xl overflow-hidden">
                <img src={proxiedStorageUrl(form.image_url)} alt="Oil" className="w-full h-32 object-cover rounded-xl" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/60 hover:bg-background/80"
                  onClick={() => setForm({ ...form, image_url: "" })}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            <label className="flex items-center justify-center gap-2 cursor-pointer rounded-xl border border-dashed border-white/30 bg-white/20 hover:bg-white/30 transition-colors px-4 py-3 text-sm text-muted-foreground">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Загрузка..." : "Загрузить фото"}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
            </label>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Описание</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="mt-1 bg-white/40 border-white/30 text-sm resize-none" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Свойства</Label>
            <Textarea value={form.properties} onChange={(e) => setForm({ ...form, properties: e.target.value })} rows={3} className="mt-1 bg-white/40 border-white/30 text-sm resize-none" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Способы применения</Label>
            <Textarea value={form.usage} onChange={(e) => setForm({ ...form, usage: e.target.value })} rows={3} className="mt-1 bg-white/40 border-white/30 text-sm resize-none" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Противопоказания</Label>
            <Textarea value={form.cautions} onChange={(e) => setForm({ ...form, cautions: e.target.value })} rows={2} className="mt-1 bg-white/40 border-white/30 text-sm resize-none" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Дополнительная информация</Label>
            <Textarea value={form.additional_info} onChange={(e) => setForm({ ...form, additional_info: e.target.value })} rows={3} placeholder="Любая дополнительная информация о масле" className="mt-1 bg-white/40 border-white/30 text-sm resize-none" />
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full gap-2 rounded-xl bg-primary/90 hover:bg-primary">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Сохранить изменения
          </Button>
        </div>
      )}

      {!selectedOilId && (
        <p className="text-center text-sm text-muted-foreground py-2">
          Выберите масло для редактирования
        </p>
      )}
    </div>
  );
}

export function AdminCodePanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { myOils, newOils } = useOils();
  const allOils = [...myOils, ...newOils];
  const [selectedOil, setSelectedOil] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [tempNickname, setTempNickname] = useState<string>("");
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; nickname: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState<{ id: string; nickname: string } | null>(null);

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ["activation_codes", selectedOil],
    queryFn: async () => {
      const query = supabase
        .from("activation_codes")
        .select("*")
        .order("created_at", { ascending: false });
      if (selectedOil) query.eq("oil_id", selectedOil);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOil) throw new Error("Выберите масло");
      const newCodes = Array.from({ length: 20 }, () => ({
        code: generateCode(),
        oil_id: selectedOil,
      }));
      const { error } = await supabase.from("activation_codes").insert(newCodes);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activation_codes"] });
      toast.success("20 кодов успешно сгенерированы!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["admin_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nickname, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resetPassword = async (userId: string, nickname: string) => {
    setResettingId(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ target_user_id: userId }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка сброса");
      setTempPassword(json.temp_password);
      setTempNickname(nickname);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setResettingId(null);
    }
  };

  const deleteUser = async (userId: string, nickname: string) => {
    setDeletingId(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ target_user_id: userId }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка удаления");
      toast.success(`Пользователь ${nickname} удалён`);
      queryClient.invalidateQueries({ queryKey: ["admin_profiles"] });
      setConfirmDelete(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const clearEntries = async (userId: string, nickname: string) => {
    setClearingId(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("Нет активной сессии. Войдите снова.");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-clear-entries`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ target_user_id: userId }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Ошибка ${res.status}`);
      }

      toast.success(`Записи ${nickname} очищены`);
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      queryClient.invalidateQueries({ queryKey: ["admin-entries"] });
      queryClient.invalidateQueries({ queryKey: ["ai_insights"] });
      queryClient.invalidateQueries({ queryKey: ["ai-insights-history"] });
      queryClient.invalidateQueries({ queryKey: ["public-entries"] });
      queryClient.invalidateQueries({ queryKey: ["group-mood-agg"] });
      queryClient.invalidateQueries({ queryKey: ["personal_summaries"] });
      setConfirmClear(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setClearingId(null);
    }
  };

  const unusedCodes = codes.filter((c: any) => !c.is_used);
  const usedCodes = codes.filter((c: any) => c.is_used);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-muted-foreground hover:text-foreground transition-all duration-300"
        >
          <KeyRound className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-card border-white/30 max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg text-foreground">
            Панель управления
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="codes" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-6 bg-white/30">
            <TabsTrigger value="codes" className="gap-1 text-[10px]">
              <KeyRound className="h-3 w-3" /> Коды
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1 text-[10px]">
              <Users className="h-3 w-3" /> Люди
            </TabsTrigger>
            <TabsTrigger value="oils" className="gap-1 text-[10px]">
              <BookOpen className="h-3 w-3" /> Масла
            </TabsTrigger>
            <TabsTrigger value="archive" className="gap-1 text-[10px]">
              <Video className="h-3 w-3" /> Видео
            </TabsTrigger>
            <TabsTrigger value="intro" className="gap-1 text-[10px]">
              <Headphones className="h-3 w-3" /> Интро
            </TabsTrigger>
            <TabsTrigger value="audio" className="gap-1 text-[10px]">
              <Headphones className="h-3 w-3" /> Аудио
            </TabsTrigger>
          </TabsList>

          {/* Codes Tab */}
          <TabsContent value="codes" className="space-y-4 overflow-y-auto flex-1 pr-1 mt-4">
            <Select value={selectedOil} onValueChange={setSelectedOil}>
              <SelectTrigger className="glass-card border-white/30">
                <SelectValue placeholder="Выберите масло" />
              </SelectTrigger>
              <SelectContent>
                {allOils.map((oil) => (
                  <SelectItem key={oil.id} value={oil.id}>
                    {oil.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={() => generateMutation.mutate()}
              disabled={!selectedOil || generateMutation.isPending}
              className="w-full gap-2 rounded-xl bg-primary/90 hover:bg-primary"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Сгенерировать 20 кодов
            </Button>

            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {unusedCodes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                      Свободные коды ({unusedCodes.length})
                    </h4>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {unusedCodes.map((c: any) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between rounded-lg bg-white/40 backdrop-blur-sm px-3 py-2 border border-white/20"
                        >
                          <code className="font-mono text-sm tracking-wider text-foreground">
                            {c.code}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full"
                            onClick={() => copyCode(c.code, c.id)}
                          >
                            {copiedId === c.id ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {usedCodes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                      Использованные ({usedCodes.length})
                    </h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {usedCodes.map((c: any) => (
                        <div
                          key={c.id}
                          className="flex items-center rounded-lg bg-muted/30 px-3 py-1.5"
                        >
                          <code className="font-mono text-xs tracking-wider text-muted-foreground line-through">
                            {c.code}
                          </code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {codes.length === 0 && selectedOil && (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    Кодов пока нет. Нажмите кнопку выше, чтобы сгенерировать.
                  </p>
                )}
              </>
            )}
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="overflow-y-auto flex-1 pr-1 mt-4">
            {profilesLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : profiles.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                Пока нет зарегистрированных участников.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">
                  Всего участников: {profiles.length}
                </p>
                {profiles.map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg bg-white/40 backdrop-blur-sm px-3 py-2.5 border border-white/20"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{p.nickname}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString("ru-RU")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs rounded-full text-muted-foreground hover:text-foreground"
                        disabled={resettingId === p.id}
                        onClick={() => resetPassword(p.id, p.nickname)}
                      >
                        {resettingId === p.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs rounded-full text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                        disabled={clearingId === p.id}
                        onClick={() => setConfirmClear({ id: p.id, nickname: p.nickname })}
                        title="Очистить записи"
                      >
                        {clearingId === p.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Eraser className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={deletingId === p.id || p.id === user?.id}
                        onClick={() => setConfirmDelete({ id: p.id, nickname: p.nickname })}
                        title={p.id === user?.id ? "Нельзя удалить себя" : "Удалить пользователя"}
                      >
                        {deletingId === p.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Oils Editor Tab */}
          <TabsContent value="oils" className="overflow-y-auto flex-1 pr-1 mt-4">
            <OilEditor allOils={allOils} />
          </TabsContent>

          {/* Meeting Archive Tab */}
          <TabsContent value="archive" className="overflow-y-auto flex-1 pr-1 mt-4">
            <MeetingArchiveManager />
          </TabsContent>

          {/* Intro Meditation Tab */}
          <TabsContent value="intro" className="overflow-y-auto flex-1 pr-1 mt-4">
            <IntroMeditationManager />
          </TabsContent>

          {/* Audio Meditations Tab */}
          <TabsContent value="audio" className="overflow-y-auto flex-1 pr-1 mt-4">
            <MeditationManager />
          </TabsContent>
        </Tabs>

        {/* Temp Password Modal */}
        {tempPassword && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-2xl">
            <div className="glass-card border-white/30 p-6 mx-4 max-w-xs w-full text-center space-y-4">
              <h3 className="font-serif text-base font-semibold text-foreground">
                Новый пароль для {tempNickname}
              </h3>
              <div className="flex items-center justify-center gap-2 rounded-xl bg-white/50 border border-white/30 px-4 py-3">
                <code className="font-mono text-lg tracking-wider text-foreground select-all">
                  {tempPassword}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(tempPassword);
                    toast.success("Пароль скопирован!");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Скопируйте и отправьте участнице. Пароль показывается только один раз.
              </p>
              <Button
                onClick={() => setTempPassword(null)}
                className="w-full rounded-full bg-violet-deep text-white hover:bg-violet-deep/90"
              >
                Готово
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent className="glass-card border-white/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Удаление пользователя</AlertDialogTitle>
            <AlertDialogDescription>
              Ты уверена, что хочешь полностью удалить пользователя <strong>{confirmDelete?.nickname}</strong> и все его записи? Это действие необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!deletingId}
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) deleteUser(confirmDelete.id, confirmDelete.nickname);
              }}
            >
              {deletingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmClear} onOpenChange={(open) => !open && setConfirmClear(null)}>
        <AlertDialogContent className="glass-card border-white/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Очистить записи</AlertDialogTitle>
            <AlertDialogDescription>
              Ты уверена, что хочешь удалить все записи, инсайты и итоги пользователя <strong>{confirmClear?.nickname}</strong>? Профиль и доступ сохранятся.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!clearingId}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-500 text-white hover:bg-amber-600"
              disabled={!!clearingId}
              onClick={(e) => {
                e.preventDefault();
                if (confirmClear) clearEntries(confirmClear.id, confirmClear.nickname);
              }}
            >
              {clearingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eraser className="h-4 w-4 mr-2" />}
              Очистить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
