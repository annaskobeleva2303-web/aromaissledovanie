import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOils } from "@/hooks/useOils";
import { OilCard } from "@/components/OilCard";
import { Button } from "@/components/ui/button";
import { Leaf, LogOut, Loader2 } from "lucide-react";

const Index = () => {
  const { profile, signOut } = useAuth();
  const { myOils, newOils, isLoading } = useOils();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Leaf className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} />
            </div>
            <span className="font-serif text-lg font-semibold">Essence Lab</span>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} className="rounded-xl">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">
          Привет, {profile?.nickname} 👋
        </h1>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* My Researches */}
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Мои исследования
              </h2>
              {myOils.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-center">
                  <Leaf className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" strokeWidth={1.5} />
                  <p className="text-sm text-muted-foreground">
                    У вас пока нет доступных масел
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    Администратор назначит вам масла для исследования
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {myOils.map((oil) => (
                    <OilCard key={oil.id} oil={oil} />
                  ))}
                </div>
              )}
            </section>

            {/* New Oils */}
            {newOils.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  Новые масла
                </h2>
                <div className="grid gap-3">
                  {newOils.map((oil) => (
                    <OilCard key={oil.id} oil={oil} locked />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
