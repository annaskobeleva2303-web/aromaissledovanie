import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import BrandIcon from "@/components/BrandIcon";
import { z } from "zod";
import { nicknameSchema } from "@/lib/nickname";

const passwordSchema = z
  .string()
  .min(6, "Минимум 6 символов")
  .max(72, "Максимум 72 символа");

export default function Auth() {
  const { user, signUp, signIn } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const nickResult = nicknameSchema.safeParse(nickname);
    if (!nickResult.success) {
      setError(nickResult.error.errors[0].message);
      return;
    }
    const passResult = passwordSchema.safeParse(password);
    if (!passResult.success) {
      setError(passResult.error.errors[0].message);
      return;
    }

    setLoading(true);
    const { error: authError } = isRegister
      ? await signUp(nickResult.data, password)
      : await signIn(nickResult.data, password);

    if (authError) setError(authError);
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      {/* Background glow orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-coral/30 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-violet/20 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center gap-4">
          <BrandIcon className="h-16 w-16" withBackground strokeWidth={1.8} />
          <h1 className="font-serif text-[2rem] font-semibold tracking-normal text-violet-deep whitespace-nowrap">
            Живые <span className="accent-italic font-normal">Смыслы</span>
          </h1>
          <p className="text-sm text-violet-deep font-normal">
            {isRegister ? "Создать аккаунт" : "Войти в аккаунт"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="glass-card p-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nickname" className="text-sm font-medium text-violet-deep">
                Никнейм
              </Label>
              <Input
                id="nickname"
                type="text"
                placeholder="Ваш никнейм"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="rounded-full border-white/30 bg-white/50 px-5 backdrop-blur-sm focus-visible:ring-primary/30 placeholder:text-violet-deep/40"
                autoComplete="username"
                maxLength={24}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-violet-deep">
                Пароль
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Минимум 6 символов"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-full border-white/30 bg-white/50 px-5 pr-11 backdrop-blur-sm focus-visible:ring-primary/30 placeholder:text-violet-deep/40"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  maxLength={72}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive animate-fade-in">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full rounded-full py-6 text-sm tracking-wide bg-violet-deep text-white transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-violet-deep/30 hover:bg-violet-deep/90"
              size="lg"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isRegister ? (
                "Создать аккаунт"
              ) : (
                "Войти"
              )}
            </Button>
          </div>
        </form>

        {/* Toggle */}
        <p className="mt-8 text-center text-sm text-violet-deep">
          {isRegister ? "Уже есть аккаунт?" : "Нет аккаунта?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="font-semibold text-primary hover:underline transition-colors"
          >
            {isRegister ? "Войти" : "Создать"}
          </button>
        </p>

        <p className="mt-5 text-center text-xs tracking-wide text-violet-deep">
          🔒 Мы не собираем email или личные данные
        </p>

        {!isRegister && (
          <p className="mt-3 text-center text-[11px] text-violet-deep/60">
            Забыли пароль? Напишите ведущей в Telegram для получения временного кода
          </p>
        )}
      </div>
    </div>
  );
}
