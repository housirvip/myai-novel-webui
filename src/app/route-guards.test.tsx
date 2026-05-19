import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { PropsWithChildren, ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/app/auth";
import { AuthOnlyRoute, ProtectedRoute } from "@/app/route-guards";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { createTestQueryClient } from "@/test/utils";

vi.mock("@/lib/auth-api", () => ({
  getSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
}));

import * as authApi from "@/lib/auth-api";

function TestProviders({ children, route }: PropsWithChildren<{ route: string }>) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function LoginLocationProbe() {
  const location = useLocation();
  const from = typeof location.state === "object" && location.state && "from" in location.state
    ? String((location.state as { from?: string }).from ?? "")
    : "";

  return (
    <div>
      <div>当前路径：{location.pathname}</div>
      <div>来源路径：{from}</div>
    </div>
  );
}

function renderWithAuth(ui: ReactNode, route: string) {
  return render(<TestProviders route={route}>{ui}</TestProviders>);
}

describe("route guards", () => {
  it("redirects unauthenticated protected routes to /app/login and preserves from", async () => {
    vi.mocked(authApi.getSession).mockResolvedValue({ user: null });

    renderWithAuth(
      <Routes>
        <Route
          path="/app/books/:bookId"
          element={(
            <ProtectedRoute>
              <div>受保护页面</div>
            </ProtectedRoute>
          )}
        />
        <Route path="/app/login" element={<LoginLocationProbe />} />
      </Routes>,
      "/app/books/7?tab=overview",
    );

    expect(await screen.findByText("当前路径：/app/login")).toBeInTheDocument();
    expect(screen.getByText("来源路径：/app/books/7?tab=overview")).toBeInTheDocument();
  });

  it("redirects authenticated auth-only routes to /app", async () => {
    vi.mocked(authApi.getSession).mockResolvedValue({
      user: { id: 1, email: "author@example.com", displayName: "Author", status: "active" },
    });

    renderWithAuth(
      <Routes>
        <Route
          path="/app/login"
          element={(
            <AuthOnlyRoute>
              <div>登录页</div>
            </AuthOnlyRoute>
          )}
        />
        <Route path="/app" element={<div>书籍页</div>} />
      </Routes>,
      "/app/login",
    );

    expect(await screen.findByText("书籍页")).toBeInTheDocument();
  });
});

describe("auth pages", () => {
  it("links from login page to /app/register", async () => {
    vi.mocked(authApi.getSession).mockResolvedValue({ user: null });

    renderWithAuth(
      <Routes>
        <Route path="/app/login" element={<LoginPage />} />
      </Routes>,
      "/app/login",
    );

    expect(await screen.findByRole("link", { name: "去注册" })).toHaveAttribute("href", "/app/register");
  });

  it("links from register page to /app/login", async () => {
    vi.mocked(authApi.getSession).mockResolvedValue({ user: null });

    renderWithAuth(
      <Routes>
        <Route path="/app/register" element={<RegisterPage />} />
      </Routes>,
      "/app/register",
    );

    expect(await screen.findByRole("link", { name: "去登录" })).toHaveAttribute("href", "/app/login");
  });
});
