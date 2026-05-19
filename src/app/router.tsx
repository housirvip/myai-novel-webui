import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";

import { AppShell } from "@/app/layouts/AppShell";
import { AuthOnlyRoute, ProtectedRoute } from "@/app/route-guards";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { BooksPage } from "@/pages/books/BooksPage";
import { BookDashboardPage } from "@/pages/books/BookDashboardPage";
import { ChapterWorkbenchPage } from "@/pages/chapters/ChapterWorkbenchPage";
import { ChapterReaderPage } from "@/pages/library/ChapterReaderPage";
import { ResourcesPage } from "@/pages/resources/ResourcesPage";
import { UserSettingsPage } from "@/pages/settings/UserSettingsPage";
import { NotFoundPage } from "@/pages/system/NotFoundPage";

const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <AppShell />,
      children: [
        { index: true, element: <Navigate to="/app" replace /> },
        {
          path: "app/login",
          element: (
            <AuthOnlyRoute>
              <LoginPage />
            </AuthOnlyRoute>
          ),
        },
        {
          path: "app/register",
          element: (
            <AuthOnlyRoute>
              <RegisterPage />
            </AuthOnlyRoute>
          ),
        },
        {
          path: "app",
          element: (
            <ProtectedRoute>
              <BooksPage />
            </ProtectedRoute>
          ),
        },
        {
          path: "app/books/:bookId",
          element: (
            <ProtectedRoute>
              <BookDashboardPage />
            </ProtectedRoute>
          ),
        },
        {
          path: "app/books/:bookId/chapters/:chapterNo",
          element: (
            <ProtectedRoute>
              <ChapterWorkbenchPage />
            </ProtectedRoute>
          ),
        },
        {
          path: "app/books/:bookId/read",
          element: (
            <ProtectedRoute>
              <ChapterReaderPage />
            </ProtectedRoute>
          ),
        },
        {
          path: "app/books/:bookId/resources",
          element: (
            <ProtectedRoute>
              <ResourcesPage />
            </ProtectedRoute>
          ),
        },
        {
          path: "app/settings",
          element: (
            <ProtectedRoute>
              <UserSettingsPage />
            </ProtectedRoute>
          ),
        },
        { path: "*", element: <NotFoundPage /> },
      ],
    },
  ],
  { basename: "/" },
);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
