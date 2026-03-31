import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Leaf, LogOut } from "lucide-react";

const Index = () => {
  const { profile, signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-nature-glow opacity-40 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-nature-glow opacity-30 blur-3xl" />
      </div>

      <div className="relative z-10 flex max-w-md flex-col items-center text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary animate-float">
          <Leaf className="h-8 w-8 text-primary-foreground" strokeWidth={1.5} />
        </div>

        <h1 className="mb-2 text-3xl font-semibold tracking-tight">
          Привет, {profile?.nickname} 👋
        </h1>
        <p className="mb-8 text-muted-foreground">
          Добро пожаловать в Essence Lab
        </p>

        <p className="mb-8 text-sm text-muted-foreground">
          Дашборд с маслами будет добавлен на следующем шаге
        </p>

        <Button variant="outline" onClick={signOut} className="rounded-xl gap-2">
          <LogOut className="h-4 w-4" />
          Выйти
        </Button>
      </div>
    </div>
  );
};

export default Index;
