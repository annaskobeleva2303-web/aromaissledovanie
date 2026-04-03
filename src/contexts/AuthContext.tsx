import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { createAuthEmailFromNickname, getSignInEmailsForNickname, normalizeNickname } from "@/lib/nickname";

interface Profile {
  id: string;
  nickname: string;
  reminders_enabled: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (nickname: string, password: string) => Promise<{ error: string | null }>;
  signIn: (nickname: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, nickname, reminders_enabled")
      .eq("id", userId)
      .single();
    setProfile(data);
  };

  const getSignUpErrorMessage = (message: string) => {
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes("already registered") || normalizedMessage.includes("already exists")) {
      return "Этот никнейм уже занят";
    }

    if (normalizedMessage.includes("email")) {
      return "Не удалось создать аккаунт. Попробуйте ещё раз с этим никнеймом.";
    }

    return `Не удалось создать аккаунт: ${message}`;
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (nickname: string, password: string) => {
    const normalizedNickname = normalizeNickname(nickname);
    const authEmail = createAuthEmailFromNickname(normalizedNickname);
    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password,
      options: {
        data: {
          nickname: normalizedNickname,
        },
      },
    });

    if (error) {
      return { error: getSignUpErrorMessage(error.message) };
    }

    if (!data.user) {
      return { error: "Не удалось завершить регистрацию. Попробуйте ещё раз." };
    }

    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password,
      });

      if (signInError) {
        return {
          error: "Аккаунт создан, но вход не завершился автоматически. Попробуйте войти тем же никнеймом и паролем.",
        };
      }
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ nickname: normalizedNickname } as any)
      .eq("id", data.user.id);

    if (profileError) {
      return {
        error: `Аккаунт создан, но никнейм не сохранился: ${profileError.message}`,
      };
    }

    await fetchProfile(data.user.id);

    return { error: null };
  };

  const signIn = async (nickname: string, password: string) => {
    let lastError: string | null = null;

    for (const authEmail of getSignInEmailsForNickname(nickname)) {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password,
      });

      if (!error) {
        return { error: null };
      }

      lastError = error.message;
    }

    if (lastError?.toLowerCase().includes("invalid login credentials")) {
      return { error: "Неверный никнейм или пароль" };
    }

    return { error: `Не удалось войти: ${lastError ?? "неизвестная ошибка"}` };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
