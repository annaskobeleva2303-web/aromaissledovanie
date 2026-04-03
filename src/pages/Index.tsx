import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOils } from "@/hooks/useOils";
import { OilCard } from "@/components/OilCard";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2, Settings } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BrandIcon from "@/components/BrandIcon";
import { NotificationCenter } from "@/components/NotificationCenter";
import { AdminCodePanel } from "@/components/AdminCodePanel";
import { ActivationModal } from "@/components/ActivationModal";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import type { Oil } from "@/hooks/useOils";

const Index = () => {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { myOils, newOils, entryCounts, isLoading } = useOils();
  const isAdmin = useIsAdmin();
  const [remindersEnabled, setRemindersEnabled] = useState(profile?.reminders_enabled ?? true);
  const [activationOil, setActivationOil] = useState<Oil | null>(null);

  useEffect(() => {
    setRemindersEnabled(profile?.reminders_enabled ?? true);
  }, [profile?.reminders_enabled]);

  const toggleReminders = async (checked: boolean) => {
    setRemindersEnabled(checked);
    const { error } = await supabase
      .from("profiles")
      .update({ reminders_enabled: checked } as any)
      .eq("id", profile!.id);
    if (error) {
      setRemindersEnabled(!checked);
      toast.error("Не удалось сохранить настройку");
    } else {
      toast.success(checked ? "Напоминания включены" : "Напоминания отключены");
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/20 bg-white/30 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <BrandIcon className="h-8 w-8" withBackground strokeWidth={1.8} />
            <span className="font-serif text-xl font-semibold tracking-normal text-violet-deep whitespace-nowrap">Живые Смыслы</span>
          </div>
          <div className="flex items-center gap-1">
            {isAdmin && <AdminCodePanel />}
            <NotificationCenter />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-muted-foreground hover:text-foreground transition-all duration-300"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 glass-card border-white/30 p-4">
                <h3 className="font-serif text-sm font-semibold text-foreground mb-3">Настройки</h3>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="reminders" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                    Напоминания о практике
                  </Label>
                  <Switch
                    id="reminders"
                    checked={remindersEnabled}
                    onCheckedChange={toggleReminders}
                  />
                </div>
                <p className="text-xs text-muted-foreground/60 mt-2">
                  Бережные напоминания, если вы давно не заглядывали в дневник
                </p>
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="rounded-full text-muted-foreground hover:text-foreground transition-all duration-300"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-2xl px-5 py-8">
        <h1 className="mb-10 font-serif text-3xl font-semibold tracking-wide text-violet-deep">
          Привет, {profile?.nickname} 👋
        </h1>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* My Researches */}
            <section className="mb-10">
              <h2 className="mb-5 font-serif text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Текущее исследование
              </h2>
              {myOils.length === 0 ? (
                <div className="glass-card p-10 text-center">
                  <BrandIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" strokeWidth={0.8} />
                  <p className="text-sm text-muted-foreground">
                    У вас пока нет доступных масел
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground/60">
                    Администратор назначит вам масла для исследования
                  </p>
                </div>
              ) : (
                <div className="grid gap-5">
                  {myOils.map((oil) => (
                    <OilCard key={oil.id} oil={oil} daysCompleted={entryCounts[oil.id] || 0} onClick={() => navigate(`/oils/${oil.id}`)} />
                  ))}
                </div>
              )}
            </section>

            {/* New Oils */}
            {newOils.length > 0 && (
              <section>
                <h2 className="mb-5 font-serif text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Новые масла
                </h2>
                <div className="grid gap-5">
                  {newOils.map((oil) => (
                    <OilCard key={oil.id} oil={oil} locked onClick={() => setActivationOil(oil)} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {activationOil && (
        <ActivationModal
          oil={activationOil}
          open={!!activationOil}
          onOpenChange={(open) => !open && setActivationOil(null)}
        />
      )}
    </div>
  );
};

export default Index;
