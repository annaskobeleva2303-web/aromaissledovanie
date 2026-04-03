import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, BookOpen, Users } from "lucide-react";
import { DiaryCalendar } from "@/components/DiaryCalendar";

const OilWorkspace = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: oil, isLoading } = useQuery({
    queryKey: ["oil", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oils")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!oil) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Масло не найдено</p>
        <Button variant="outline" onClick={() => navigate("/")} className="rounded-full">
          На главную
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/20 bg-white/30 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="shrink-0 rounded-full text-muted-foreground hover:text-foreground transition-all duration-300"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate font-serif text-xl font-medium tracking-wide">{oil.title}</h1>
            {oil.focus && (
              <p className="truncate text-xs tracking-wide text-muted-foreground">{oil.focus}</p>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <main className="mx-auto max-w-2xl px-5 py-8">
        <Tabs defaultValue="diary">
          <TabsList className="w-full rounded-full bg-white/30 backdrop-blur-xl border border-white/20 p-1">
            <TabsTrigger
              value="diary"
              className="flex-1 gap-1.5 rounded-full text-sm transition-all duration-300 data-[state=active]:bg-white/60 data-[state=active]:shadow-sm data-[state=active]:backdrop-blur-md"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Мой Дневник
            </TabsTrigger>
            <TabsTrigger
              value="group"
              className="flex-1 gap-1.5 rounded-full text-sm transition-all duration-300 data-[state=active]:bg-white/60 data-[state=active]:shadow-sm data-[state=active]:backdrop-blur-md"
            >
              <Users className="h-3.5 w-3.5" />
              Групповое поле
            </TabsTrigger>
          </TabsList>

          <TabsContent value="diary" className="mt-8">
            <DiaryForm oilId={oil.id} />
          </TabsContent>

          <TabsContent value="group" className="mt-8">
            <div className="glass-card p-12 text-center">
              <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">
                Групповое поле будет доступно позже
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default OilWorkspace;
