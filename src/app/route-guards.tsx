import type { PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/app/auth";

export function ProtectedRoute({ children }: PropsWithChildren) {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">正在恢复会话...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/app/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <>{children}</>;
}

export function AuthOnlyRoute({ children }: PropsWithChildren) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">正在恢复会话...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
