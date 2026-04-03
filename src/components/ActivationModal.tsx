import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, KeyRound, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Oil } from "@/hooks/useOils";

interface ActivationModalProps {
  oil: Oil;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ActivationModal({ oil, open, onOpenChange }: ActivationModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleActivate = async () => {
    if (!user || !code.trim()) return;
    setLoading(true);
    setError("");

    const normalizedCode = code.trim().toUpperCase();

    // Find the code
    const { data: codeRecord, error: fetchError } = await supabase
      .from("activation_codes")
      .select("*")
      .eq("code", normalizedCode)
      .eq("oil_id", oil.id)
      .eq("is_used", false)
      .maybeSingle();

    if (fetchError || !codeRecord) {
      setError("Код не найден или уже использован");
      setLoading(false);
      return;
    }

    // Create access
    const { error: accessError } = await supabase
      .from("user_access")
      .insert({ user_id: user.id, oil_id: oil.id });

    if (accessError) {
      setError("Не удалось активировать доступ");
      setLoading(false);
      return;
    }

    // Mark code as used
    await supabase
      .from("activation_codes")
      .update({ is_used: true, used_by: user.id } as any)
      .eq("id", codeRecord.id);

    queryClient.invalidateQueries({ queryKey: ["user_access"] });
    queryClient.invalidateQueries({ queryKey: ["activation_codes"] });
    toast.success("Доступ к исследованию активирован! 🌿");
    setCode("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-white/30 max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-glow">
            <KeyRound className="h-6 w-6 text-primary" strokeWidth={1.5} />
          </div>
          <DialogTitle className="font-serif text-center text-lg text-foreground">
            Доступ к «{oil.title}»
          </DialogTitle>
        </DialogHeader>

        <p className="text-center text-sm text-muted-foreground leading-relaxed">
          Для участия в исследовании введите ваш персональный код доступа
        </p>

        <div className="mt-4 space-y-3">
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError("");
            }}
            placeholder="XXXX-XXXX"
            className="text-center font-mono text-lg tracking-[0.3em] glass-card border-white/30 h-12 placeholder:tracking-[0.3em] placeholder:text-muted-foreground/40"
            maxLength={9}
            autoFocus
          />

          {error && (
            <p className="text-center text-xs text-destructive animate-fade-in">{error}</p>
          )}

          <Button
            onClick={handleActivate}
            disabled={loading || code.trim().length < 4}
            className="w-full gap-2 rounded-xl bg-primary/90 hover:bg-primary h-11"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Активировать
          </Button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/50 leading-relaxed mt-1">
          Код одноразовый и привязывается к вашему аккаунту
        </p>
      </DialogContent>
    </Dialog>
  );
}
