import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOils } from "@/hooks/useOils";
import { Button } from "@/components/ui/button";
import { Copy, Check, Loader2, KeyRound, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function AdminCodePanel() {
  const queryClient = useQueryClient();
  const { myOils, newOils } = useOils();
  const allOils = [...myOils, ...newOils];
  const [selectedOil, setSelectedOil] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
            Управление кодами доступа
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
