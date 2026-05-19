import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useMemo } from "react";

import { getSession, login, logout, register } from "@/lib/auth-api";
import { queryKeys } from "@/lib/query/query-keys";
import type { LoginInput, RegisterInput, SessionUserView } from "@/lib/types";

interface AuthContextValue {
  user: SessionUserView | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<SessionUserView>;
  register: (input: RegisterInput) => Promise<SessionUserView>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: queryKeys.authSession(),
    queryFn: () => getSession(),
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: async (user) => {
      queryClient.setQueryData(queryKeys.authSession(), { user });
      await queryClient.invalidateQueries();
    },
  });

  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: async (user) => {
      queryClient.setQueryData(queryKeys.authSession(), { user });
      await queryClient.invalidateQueries();
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      queryClient.setQueryData(queryKeys.authSession(), { user: null });
      await queryClient.invalidateQueries();
    },
  });

  const value = useMemo<AuthContextValue>(() => ({
    user: sessionQuery.data?.user ?? null,
    isLoading: sessionQuery.isLoading,
    isAuthenticated: Boolean(sessionQuery.data?.user),
    login: async (input) => loginMutation.mutateAsync(input),
    register: async (input) => registerMutation.mutateAsync(input),
    logout: async () => {
      await logoutMutation.mutateAsync();
    },
    refresh: async () => {
      await sessionQuery.refetch();
    },
  }), [loginMutation, logoutMutation, registerMutation, sessionQuery]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
