import { Sparkles, Calendar, Users, BookOpen, Activity } from "lucide-react";
import { motion } from "framer-motion";

export type WorkspaceTab = "practice" | "diary" | "field" | "library" | "analytics";

const TABS: { id: WorkspaceTab; label: string; Icon: typeof Sparkles }[] = [
  { id: "practice", label: "Практика", Icon: Sparkles },
  { id: "diary", label: "Дневник", Icon: Calendar },
  { id: "field", label: "Поле", Icon: Users },
  { id: "library", label: "Библиотека", Icon: BookOpen },
  { id: "analytics", label: "Аналитика", Icon: Activity },
];

interface BottomTabBarProps {
  active: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
}

export function BottomTabBar({ active, onChange }: BottomTabBarProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2"
      aria-label="Основная навигация"
    >
      <div className="mx-auto max-w-2xl px-3">
        <div className="relative flex items-stretch justify-between rounded-[1.75rem] border border-white/30 bg-white/40 backdrop-blur-2xl shadow-[0_8px_30px_rgba(99,102,241,0.18)] px-1.5 py-1.5">
          {TABS.map(({ id, label, Icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange(id)}
                className="relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-2 transition-colors duration-300"
                aria-current={isActive ? "page" : undefined}
              >
                {isActive && (
                  <motion.span
                    layoutId="bottom-tab-active"
                    className="absolute inset-0 rounded-2xl bg-white/70 shadow-[0_0_22px_6px_rgba(168,139,250,0.25)]"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative flex flex-col items-center gap-0.5">
                  <Icon
                    className={`h-[18px] w-[18px] transition-colors duration-300 ${
                      isActive ? "text-violet-deep" : "text-muted-foreground"
                    }`}
                    strokeWidth={isActive ? 2.1 : 1.7}
                  />
                  <span
                    className={`text-[10px] font-medium tracking-wide transition-colors duration-300 ${
                      isActive ? "text-violet-deep" : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
