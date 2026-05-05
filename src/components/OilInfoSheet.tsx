import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { BookOpen, Headphones } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { proxiedStorageUrl } from "@/lib/storageUrl";
import { OilAudioPlayer } from "@/components/OilAudioPlayer";

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

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-2"
    >
      <h3 className="font-serif text-sm font-semibold uppercase tracking-[0.12em] text-foreground/80">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-foreground/70 whitespace-pre-line">
        {text}
      </p>
    </motion.div>
  );
}

export function OilInfoSheet({ oil }: OilInfoSheetProps) {
  const hasContent = oil.description || oil.properties || oil.usage || oil.cautions || oil.additional_info;

  if (!hasContent && !oil.image_url) return null;

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
            {/* Soft edge fade */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          </motion.div>
        )}

        {/* Text sections */}
        <div className="space-y-6">
          {oil.description && <InfoBlock title="Описание" text={oil.description} />}
          {oil.properties && <InfoBlock title="Свойства" text={oil.properties} />}
          {oil.usage && <InfoBlock title="Способы применения" text={oil.usage} />}
          {oil.cautions && <InfoBlock title="Противопоказания" text={oil.cautions} />}
          {oil.additional_info && <InfoBlock title="Дополнительная информация" text={oil.additional_info} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
