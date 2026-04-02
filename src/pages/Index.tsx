import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOils } from "@/hooks/useOils";
import { OilCard } from "@/components/OilCard";
import { Button } from "@/components/ui/button";
import { Leaf, LogOut, Loader2 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { myOils, newOils, isLoading } = useOils();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/20 bg-white/30 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary shadow-md shadow-primary/20">
              <Leaf className="h-5 w-5 text-primary-foreground" strokeWidth={1.5} />
            </div>
            <span className="font-serif text-xl font-medium tracking-wide">Essence Lab</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="rounded-full text-muted-foreground hover:text-foreground transition-all duration-300"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-2xl px-5 py-8">
        <h1 className="mb-8 font-serif text-3xl font-medium tracking-wide">
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
              <h2 className="mb-5 font-serif text-sm font-medium uppercase tracking-[0.15em] text-muted-foreground">
                Мои исследования
              </h2>
              {myOils.length === 0 ? (
                <div className="glass-card p-10 text-center">
                  <Leaf className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" strokeWidth={1.5} />
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
                    <OilCard key={oil.id} oil={oil} onClick={() => navigate(`/oils/${oil.id}`)} />
                  ))}
                </div>
              )}
            </section>

            {/* New Oils */}
            {newOils.length > 0 && (
              <section>
                <h2 className="mb-5 font-serif text-sm font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  Новые масла
                </h2>
                <div className="grid gap-5">
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
