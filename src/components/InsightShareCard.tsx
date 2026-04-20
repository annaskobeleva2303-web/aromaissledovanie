import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Download, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const MOODS: Record<string, { label: string; emoji: string }> = {
  calm: { label: "Спокойствие", emoji: "😌" },
  anxious: { label: "Тревога", emoji: "😟" },
  joyful: { label: "Радость", emoji: "😊" },
  sad: { label: "Грусть", emoji: "😢" },
  energetic: { label: "Энергия", emoji: "⚡" },
  irritated: { label: "Раздражение", emoji: "😤" },
  reflective: { label: "Задумчивость", emoji: "🤔" },
  grateful: { label: "Благодарность", emoji: "🙏" },
};

interface InsightShareCardProps {
  insightText: string;
  shareQuote?: string | null;
  oilTitle?: string;
  moodBefore?: string | null;
  moodAfter?: string | null;
  energyBefore?: number | null;
  energyAfter?: number | null;
  moodScoreBefore?: number | null;
  moodScoreAfter?: number | null;
}

export function InsightShareCard({
  insightText,
  shareQuote,
  oilTitle = "Даваной",
  moodBefore,
  moodAfter,
  energyBefore,
  energyAfter,
  moodScoreBefore,
  moodScoreAfter,
}: InsightShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [done, setDone] = useState(false);

  const hasTransformation =
    (moodBefore && moodAfter) ||
    (energyBefore != null && energyAfter != null);

  // Use shareQuote for the card; fall back to truncated insight
  const cardQuote = shareQuote || (insightText.length > 120 ? insightText.slice(0, 117) + "..." : insightText);

  const formatInsightText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(_[^_]+_|\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
        return (
          <span
            key={i}
            style={{
              fontFamily: "'Playfair Display', 'Cormorant Garamond', serif",
              fontStyle: "italic",
              color: "hsl(20 90% 74%)",
              fontSize: "1.1em",
            }}
          >
            {part.slice(1, -1)}
          </span>
        );
      }
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return (
          <span
            key={i}
            style={{
              fontFamily: "'Playfair Display', 'Cormorant Garamond', serif",
              fontStyle: "italic",
              color: "hsl(20 90% 74%)",
              fontSize: "1.1em",
            }}
          >
            {part.slice(2, -2)}
          </span>
        );
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return (
          <span
            key={i}
            style={{
              fontFamily: "'Playfair Display', 'Cormorant Garamond', serif",
              fontStyle: "italic",
              color: "hsl(20 90% 74%)",
              fontSize: "1.1em",
            }}
          >
            {part.slice(1, -1)}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const generateImage = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });
      return new Promise((resolve) =>
        canvas.toBlob((blob) => resolve(blob), "image/png", 1)
      );
    } catch {
      return null;
    }
  };

  const handleShare = async () => {
    setIsGenerating(true);
    try {
      const blob = await generateImage();
      if (!blob) {
        toast.error("Не удалось создать изображение");
        return;
      }

      const file = new File([blob], "insight-card.png", { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Мой инсайт",
        });
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "insight-card.png";
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Карточка сохранена");
      }
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        toast.error("Ошибка при сохранении");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden card template for rendering */}
      <div
        className="absolute pointer-events-none"
        style={{ left: "-9999px", top: 0 }}
      >
        <div
          ref={cardRef}
          style={{
            width: 540,
            height: 960,
            position: "relative",
            overflow: "hidden",
            borderRadius: 32,
            fontFamily: "'Cormorant Garamond', 'Georgia', serif",
          }}
        >
          {/* Background gradient */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(160deg, hsl(263 72% 18%) 0%, hsl(263 60% 28%) 30%, hsl(280 50% 22%) 60%, hsl(20 60% 25%) 100%)",
            }}
          />
          {/* Decorative orbs */}
          <div
            style={{
              position: "absolute",
              top: -80,
              right: -60,
              width: 280,
              height: 280,
              borderRadius: "50%",
              background: "radial-gradient(circle, hsla(263 72% 52% / 0.35), transparent 70%)",
              filter: "blur(40px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -60,
              left: -40,
              width: 240,
              height: 240,
              borderRadius: "50%",
              background: "radial-gradient(circle, hsla(20 90% 60% / 0.25), transparent 70%)",
              filter: "blur(40px)",
            }}
          />
          {/* Glass overlay */}
          <div
            style={{
              position: "absolute",
              inset: 24,
              borderRadius: 24,
              background: "hsla(0 0% 100% / 0.06)",
              border: "1px solid hsla(0 0% 100% / 0.12)",
              backdropFilter: "blur(20px)",
            }}
          />

          {/* Content */}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              flexDirection: "column",
              height: "100%",
              padding: "48px 40px 40px",
            }}
          >
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <p
                style={{
                  fontSize: 11,
                  letterSpacing: "0.25em",
                  textTransform: "uppercase",
                  color: "hsla(20 90% 74% / 0.8)",
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 500,
                  marginBottom: 8,
                }}
              >
                Трансформация
              </p>
              <p
                style={{
                  fontSize: 26,
                  fontWeight: 600,
                  color: "hsla(0 0% 100% / 0.92)",
                  lineHeight: 1.3,
                }}
              >
                с {oilTitle}
              </p>
            </div>

            {/* Transformation delta */}
            {hasTransformation && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 20,
                  marginBottom: 28,
                  padding: "16px 24px",
                  borderRadius: 20,
                  background: "hsla(0 0% 100% / 0.06)",
                  border: "1px solid hsla(0 0% 100% / 0.1)",
                }}
              >
                {moodBefore && moodAfter && (
                  <>
                    <div style={{ textAlign: "center" }}>
                      <span style={{ fontSize: 36 }}>
                        {MOODS[moodBefore]?.emoji || "•"}
                      </span>
                      <p
                        style={{
                          fontSize: 10,
                          color: "hsla(0 0% 100% / 0.5)",
                          marginTop: 4,
                          fontFamily: "'Inter', sans-serif",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                        }}
                      >
                        до
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: 20,
                        color: "hsla(20 90% 74% / 0.7)",
                      }}
                    >
                      ➔
                    </span>
                    <div style={{ textAlign: "center" }}>
                      <span style={{ fontSize: 36 }}>
                        {MOODS[moodAfter]?.emoji || "•"}
                      </span>
                      <p
                        style={{
                          fontSize: 10,
                          color: "hsla(0 0% 100% / 0.5)",
                          marginTop: 4,
                          fontFamily: "'Inter', sans-serif",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                        }}
                      >
                        после
                      </p>
                    </div>
                  </>
                )}
                {energyBefore != null && energyAfter != null && !moodBefore && (
                  <>
                    <div style={{ textAlign: "center" }}>
                      <span
                        style={{
                          fontSize: 28,
                          fontWeight: 600,
                          color: "hsla(0 0% 100% / 0.85)",
                        }}
                      >
                        ⚡ {energyBefore}
                      </span>
                      <p
                        style={{
                          fontSize: 10,
                          color: "hsla(0 0% 100% / 0.5)",
                          marginTop: 4,
                          fontFamily: "'Inter', sans-serif",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                        }}
                      >
                        до
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: 20,
                        color: "hsla(20 90% 74% / 0.7)",
                      }}
                    >
                      ➔
                    </span>
                    <div style={{ textAlign: "center" }}>
                      <span
                        style={{
                          fontSize: 28,
                          fontWeight: 600,
                          color: "hsla(0 0% 100% / 0.85)",
                        }}
                      >
                        ⚡ {energyAfter}
                      </span>
                      <p
                        style={{
                          fontSize: 10,
                          color: "hsla(0 0% 100% / 0.5)",
                          marginTop: 4,
                          fontFamily: "'Inter', sans-serif",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                        }}
                      >
                        после
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Quote / Insight */}
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <div
                style={{
                  padding: "24px 20px",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    fontSize: 48,
                    lineHeight: 0.6,
                    color: "hsla(20 90% 74% / 0.4)",
                    marginBottom: 12,
                  }}
                >
                  «
                </div>
                <p
                  style={{
                    fontSize: shareQuote ? 24 : 19,
                    lineHeight: 1.7,
                    color: "hsla(0 0% 100% / 0.92)",
                    fontWeight: shareQuote ? 500 : 400,
                    fontStyle: "normal",
                    fontFamily: "'Inter', sans-serif",
                    textAlign: "center",
                  }}
                >
                  {formatInsightText(cardQuote)}
                </p>
                <div
                  style={{
                    fontSize: 48,
                    lineHeight: 0.6,
                    color: "hsla(20 90% 74% / 0.4)",
                    textAlign: "right",
                    marginTop: 12,
                  }}
                >
                  »
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                textAlign: "center",
                paddingTop: 20,
                borderTop: "1px solid hsla(0 0% 100% / 0.08)",
              }}
            >
              <p
                style={{
                  fontSize: 13,
                  letterSpacing: "0.15em",
                  color: "hsla(0 0% 100% / 0.35)",
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 400,
                }}
              >
                Дневник состояний
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Share button */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <Button
          onClick={handleShare}
          disabled={isGenerating}
          variant="ghost"
          className="w-full rounded-full gap-2.5 py-5 text-sm tracking-wide border border-white/20 bg-white/20 backdrop-blur-xl hover:bg-white/30 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_0_20px_6px_rgba(255,180,80,0.15)]"
        >
          <AnimatePresence mode="wait">
            {isGenerating ? (
              <motion.span
                key="loading"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <Loader2 className="h-4 w-4 animate-spin" />
              </motion.span>
            ) : done ? (
              <motion.span
                key="done"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <Check className="h-4 w-4 text-primary" />
              </motion.span>
            ) : (
              <motion.span
                key="share"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-2"
              >
                <Share2 className="h-4 w-4" />
                <Download className="h-3.5 w-3.5 opacity-50" />
              </motion.span>
            )}
          </AnimatePresence>
          {isGenerating
            ? "Создаю карточку..."
            : done
              ? "Готово!"
              : "Сохранить карточку"}
        </Button>
      </motion.div>
    </div>
  );
}
