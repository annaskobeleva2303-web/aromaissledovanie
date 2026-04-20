import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { NotificationCenter } from "@/components/NotificationCenter";
import { SparkleBackground } from "@/components/SparkleBackground";
import { BottomTabBar, type WorkspaceTab } from "@/components/workspace/BottomTabBar";
import { PracticeTab } from "@/components/workspace/PracticeTab";
import { DiaryTab } from "@/components/workspace/DiaryTab";
import { FieldTab } from "@/components/workspace/FieldTab";
import { LibraryTab } from "@/components/workspace/LibraryTab";
import { AnalyticsTab } from "@/components/workspace/AnalyticsTab";

const OilWorkspace = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<WorkspaceTab>("practice");

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
    <div className="min-h-screen relative pb-28">
      <SparkleBackground />
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
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-[15px] sm:text-base font-medium leading-tight tracking-wide text-foreground">
              {oil.title}
            </h1>
            {oil.focus && (
              <p className="mt-0.5 text-[11px] leading-snug tracking-wide text-muted-foreground">
                {oil.focus}
              </p>
            )}
          </div>
          <NotificationCenter />
        </div>
      </header>

      {/* Tab content */}
      <main className="mx-auto max-w-2xl px-5 py-8">
        {tab === "practice" && <PracticeTab oil={oil} />}
        {tab === "diary" && <DiaryTab oil={oil} />}
        {tab === "field" && <FieldTab oil={oil} />}
        {tab === "library" && <LibraryTab oil={oil} />}
        {tab === "analytics" && <AnalyticsTab oil={oil} />}
      </main>

      <BottomTabBar active={tab} onChange={setTab} />
    </div>
  );
};

export default OilWorkspace;
