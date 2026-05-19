import { apiGet, apiPost } from "@/lib/api";
import type { AuthSessionView, LoginInput, RegisterInput, SessionUserView } from "@/lib/types";

export function getSession() {
  return apiGet<AuthSessionView>("/api/auth/session");
}

export function login(input: LoginInput) {
  return apiPost<SessionUserView, LoginInput>("/api/auth/login", input);
}

export function register(input: RegisterInput) {
  return apiPost<SessionUserView, RegisterInput>("/api/auth/register", input);
}

export function logout() {
  return apiPost<{ ok: true }, Record<string, never>>("/api/auth/logout", {});
}
