import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, BookOpen, Users } from "lucide-react";
import { DiaryForm } from "@/components/DiaryForm";

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
        <Button variant="outline" onClick={() => navigate("/")}>
          На главную
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="shrink-0 rounded-xl"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{oil.title}</h1>
            {oil.focus && (
              <p className="truncate text-xs text-muted-foreground">{oil.focus}</p>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <main className="mx-auto max-w-2xl px-4 py-5">
        <Tabs defaultValue="diary">
          <TabsList className="w-full rounded-xl bg-secondary">
            <TabsTrigger value="diary" className="flex-1 gap-1.5 rounded-lg">
              <BookOpen className="h-3.5 w-3.5" />
              Мой Дневник
            </TabsTrigger>
            <TabsTrigger value="group" className="flex-1 gap-1.5 rounded-lg">
              <Users className="h-3.5 w-3.5" />
              Групповое поле
            </TabsTrigger>
          </TabsList>

          <TabsContent value="diary" className="mt-5">
            <DiaryForm oilId={oil.id} />
          </TabsContent>

          <TabsContent value="group" className="mt-5">
            <div className="rounded-2xl border border-dashed p-10 text-center">
              <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" strokeWidth={1.5} />
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
