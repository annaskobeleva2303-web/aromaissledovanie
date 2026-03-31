import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Leaf } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Leaf className="h-8 w-8 animate-float text-primary" strokeWidth={1.5} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
