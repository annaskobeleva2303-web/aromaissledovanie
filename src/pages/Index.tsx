import { Leaf, Shield, Sparkles } from "lucide-react";

const Index = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      {/* Decorative background circles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-nature-glow opacity-40 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-nature-glow opacity-30 blur-3xl" />
      </div>

      <div className="relative z-10 flex max-w-md flex-col items-center text-center">
        {/* Logo */}
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary animate-float">
          <Leaf className="h-10 w-10 text-primary-foreground" strokeWidth={1.5} />
        </div>

        {/* Title */}
        <h1 className="mb-3 text-4xl font-semibold tracking-tight">
          Essence Lab
        </h1>
        <p className="mb-10 max-w-xs text-lg leading-relaxed text-muted-foreground">
          Закрытая платформа для исследования эфирных масел
        </p>

        {/* Feature pills */}
        <div className="mb-12 flex flex-col gap-3 w-full">
          {[
            { icon: Shield, text: "100% анонимность" },
            { icon: Sparkles, text: "ИИ-аналитика дневников" },
            { icon: Leaf, text: "Модульная система масел" },
          ].map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-3 rounded-2xl bg-card px-5 py-4 shadow-sm border border-border"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-nature-glow">
                <Icon className="h-4.5 w-4.5 text-primary" strokeWidth={1.8} />
              </div>
              <span className="text-sm font-medium text-foreground">{text}</span>
            </div>
          ))}
        </div>

        {/* Placeholder CTA */}
        <p className="text-xs text-muted-foreground">
          Авторизация будет добавлена на следующем шаге
        </p>
      </div>
    </div>
  );
};

export default Index;
