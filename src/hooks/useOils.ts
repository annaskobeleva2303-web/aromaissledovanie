import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Oil {
  id: string;
  title: string;
  description: string | null;
  focus: string | null;
  is_active: boolean;
  image_url: string | null;
  intro_meditation_url: string | null;
}

export function useOils() {
  const { user } = useAuth();

  const { data: allOils = [], isLoading: oilsLoading } = useQuery({
    queryKey: ["oils"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oils")
        .select("*")
        .eq("is_active", true)
        .order("title");
      if (error) throw error;
      return data as Oil[];
    },
    enabled: !!user,
  });

  const { data: accessList = [], isLoading: accessLoading } = useQuery({
    queryKey: ["user_access", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_access")
        .select("oil_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data.map((a) => a.oil_id);
    },
    enabled: !!user,
  });

  const { data: entryCounts = {} } = useQuery({
    queryKey: ["entry_counts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("oil_id, date")
        .eq("user_id", user!.id);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const e of data) {
        const key = `${e.oil_id}|${e.date}`;
        if (!counts[e.oil_id]) counts[e.oil_id] = 0;
        if (!counts[key]) {
          counts[key] = 1;
          counts[e.oil_id]++;
        }
      }
      // Return only oil_id -> unique days count
      const result: Record<string, number> = {};
      for (const o of allOils) {
        result[o.id] = counts[o.id] || 0;
      }
      return result;
    },
    enabled: !!user && allOils.length > 0,
  });

  const myOils = allOils.filter((o) => accessList.includes(o.id));
  const newOils = allOils.filter((o) => !accessList.includes(o.id));

  return {
    myOils,
    newOils,
    entryCounts,
    isLoading: oilsLoading || accessLoading,
  };
}
