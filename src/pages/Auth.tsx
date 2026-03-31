import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Leaf, Eye, EyeOff, Loader2 } from "lucide-react";
import { z } from "zod";

const nicknameSchema = z
  .string()
  .trim()
  .min(3, "Минимум 3 символа")
  .max(24, "Максимум 24 символа")
  .regex(/^[a-zA-Z0-9_а-яА-ЯёЁ]+$/, "Только буквы, цифры и _");

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

    // Validate
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
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-nature-glow opacity-40 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-nature-glow opacity-30 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Leaf className="h-8 w-8 text-primary-foreground" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Essence Lab</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isRegister ? "Создать аккаунт" : "Войти в аккаунт"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nickname" className="text-sm font-medium">
                Никнейм
              </Label>
              <Input
                id="nickname"
                type="text"
                placeholder="Ваш никнейм"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="rounded-xl"
                autoComplete="username"
                maxLength={24}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Пароль
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Минимум 6 символов"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-xl pr-10"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  maxLength={72}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive animate-fade-in">{error}</p>
            )}

            <Button type="submit" className="w-full rounded-xl" size="lg" disabled={loading}>
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
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isRegister ? "Уже есть аккаунт?" : "Нет аккаунта?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="font-medium text-primary hover:underline"
          >
            {isRegister ? "Войти" : "Создать"}
          </button>
        </p>

        {/* Anonymity note */}
        <p className="mt-4 text-center text-xs text-muted-foreground/70">
          🔒 Мы не собираем email или личные данные
        </p>
      </div>
    </div>
  );
}
