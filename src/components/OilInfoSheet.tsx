import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { BookOpen, Headphones } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { proxiedStorageUrl } from "@/lib/storageUrl";
import { OilAudioPlayer } from "@/components/OilAudioPlayer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface OilInfo {
  id?: string;
  title: string;
  description?: string | null;
  properties?: string | null;
  usage?: string | null;
  cautions?: string | null;
  additional_info?: string | null;
  image_url?: string | null;
}

interface OilInfoSheetProps {
  oil: OilInfo;
}

function InfoBlock({ value, title, text }: { value: string; title: string; text: string }) {
  return (
    <AccordionItem value={value} className="border-b border-white/10 last:border-b-0">
      <AccordionTrigger className="py-3 hover:no-underline">
        <h3 className="font-serif text-sm font-semibold uppercase tracking-[0.12em] text-foreground/80 text-left">
          {title}
        </h3>
      </AccordionTrigger>
      <AccordionContent>
        <p className="text-sm leading-relaxed text-foreground/70 whitespace-pre-line pt-1 pb-2">
          {text}
        </p>
      </AccordionContent>
    </AccordionItem>
  );
}

export function OilInfoSheet({ oil }: OilInfoSheetProps) {
  const { data: media = [] } = useQuery({
    queryKey: ["oil_media_public", oil.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oil_media")
        .select("id, title, description, file_url, order_index")
        .eq("oil_id", oil.id!)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Array<{ id: string; title: string; description: string | null; file_url: string; order_index: number }>;
    },
    enabled: !!oil.id,
  });

  const hasContent = oil.description || oil.properties || oil.usage || oil.cautions || oil.additional_info;

  if (!hasContent && !oil.image_url && media.length === 0) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-muted-foreground hover:text-foreground transition-all duration-300"
        >
          <BookOpen className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="glass-card border-white/20 rounded-t-3xl max-h-[85vh] overflow-y-auto px-6 pb-10"
      >
        <SheetHeader className="mb-6">
          <SheetTitle className="font-serif text-xl tracking-wide text-foreground">
            О масле {oil.title}
          </SheetTitle>
        </SheetHeader>

        {/* Hero image */}
        {oil.image_url && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative mb-8 overflow-hidden rounded-2xl"
          >
            <img
              src={proxiedStorageUrl(oil.image_url)}
              alt={oil.title}
              className="w-full h-52 object-cover"
            />
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          </motion.div>
        )}

        {/* Text sections */}
        <div className="space-y-6">
          {(oil.description || oil.properties || oil.usage || oil.cautions || oil.additional_info) && (
            <Accordion type="single" collapsible className="w-full">
              {oil.description && <InfoBlock value="description" title="О масле" text={oil.description} />}
              {oil.properties && <InfoBlock value="properties" title="Свойства" text={oil.properties} />}
              {oil.usage && <InfoBlock value="usage" title="Способы применения" text={oil.usage} />}
              {oil.cautions && <InfoBlock value="cautions" title="Противопоказания" text={oil.cautions} />}
              {oil.additional_info && <InfoBlock value="additional" title="Дополнительная информация" text={oil.additional_info} />}
            </Accordion>
          )}

          {media.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="font-serif text-sm font-semibold uppercase tracking-[0.12em] text-foreground/80 flex items-center gap-2">
                <Headphones className="h-3.5 w-3.5" /> Аудио-практики
              </h3>
              <div className="space-y-3">
                {media.map((m) => (
                  <OilAudioPlayer
                    key={m.id}
                    title={m.title}
                    description={m.description}
                    src={m.file_url}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
