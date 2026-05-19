import { BookOpenText, ChevronLeft, ChevronRight, FolderKanban, Library, LogOut, PenSquare, Settings, Sparkles } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "@/app/auth";
import { bookDashboardPath, bookReaderPath, bookResourcesPath, parseBookId, settingsPath } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const { user, logout } = useAuth();
  const currentBookId = parseBookId(params.bookId);
  const isAuthRoute = location.pathname === "/app/login" || location.pathname === "/app/register";
  const isBookDashboardRoute = currentBookId !== null && (location.pathname === bookDashboardPath(currentBookId) || location.pathname.startsWith(`${bookDashboardPath(currentBookId)}/chapters/`));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigation = [
    {
      label: "书籍总览",
      to: "/app",
      icon: Library,
      end: true,
      disabled: false,
    },
    {
      label: "写作工作台",
      to: currentBookId === null ? "/app" : bookDashboardPath(currentBookId),
      icon: PenSquare,
      disabled: currentBookId === null,
    },
    {
      label: "资源中心",
      to: currentBookId === null ? "/app" : bookResourcesPath(currentBookId),
      icon: FolderKanban,
      disabled: currentBookId === null,
    },
    {
      label: "章节阅读",
      to: currentBookId === null ? "/app" : bookReaderPath(currentBookId),
      icon: BookOpenText,
      disabled: currentBookId === null,
    },
    {
      label: "个人设置",
      to: settingsPath(),
      icon: Settings,
      disabled: false,
    },
  ];
  if (isAuthRoute) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 px-4 py-4 lg:px-6">
        <aside
          className={cn(
            "hidden shrink-0 flex-col rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-glow backdrop-blur transition-all xl:flex",
            sidebarCollapsed ? "w-24" : "w-64",
          )}
        >
          <div className={cn("rounded-2xl border border-indigo-200/20 bg-gradient-to-br from-indigo-600 via-violet-600 to-slate-900 px-4 py-4 text-white shadow-lg shadow-indigo-950/15", sidebarCollapsed ? "flex justify-center" : "flex items-center gap-3")}>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/12 text-indigo-50 backdrop-blur-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <div className="text-sm text-indigo-100/80">AI 小说工作台</div>
                <div className="text-lg font-semibold tracking-tight text-white">myai-novel WebUI</div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            className="mt-4 flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
            aria-label={sidebarCollapsed ? "展开导航栏" : "折叠导航栏"}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            <span className={cn("ml-2", sidebarCollapsed && "sr-only")}>{sidebarCollapsed ? "展开" : "折叠侧栏"}</span>
          </button>

          <nav className="mt-6 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  end={item.end ?? item.to === "/app"}
                  aria-disabled={item.disabled}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      "flex rounded-2xl px-4 py-3 text-sm font-medium transition",
                      sidebarCollapsed ? "items-center justify-center" : "items-center gap-3",
                      item.disabled
                        ? "cursor-not-allowed bg-slate-50 text-slate-400"
                        : (item.label === "写作工作台" ? isBookDashboardRoute : isActive)
                          ? "bg-primary text-primary-foreground shadow-glow"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                    )
                  }
                  onClick={(event) => {
                    if (item.disabled) {
                      event.preventDefault();
                    }
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </NavLink>
              );
            })}
          </nav>

          {currentBookId === null && !sidebarCollapsed && (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              先从书籍总览进入一本书，侧边栏会自动切换到当前书籍上下文。
            </div>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="rounded-[28px] border border-white/70 bg-white/75 px-6 py-5 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-medium text-primary">Novel Ops Console</p>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">可视化 AI 写小说工作台</h1>
                <p className="mt-1 text-sm text-slate-500">
                  基于现有 HTTP server 的章节生命周期、资源管理与成稿阅读界面。
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {currentBookId ? `当前书籍：#${currentBookId}` : "当前未选择书籍"}
              </div>
              {user && (
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-900">{user.displayName}</div>
                    <div className="truncate text-xs text-slate-500">{user.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await logout();
                      navigate("/app/login", { replace: true });
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-200"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    退出
                  </button>
                </div>
              )}
            </div>
          </header>

          <main className="min-h-[calc(100vh-10rem)] rounded-[32px] border border-white/70 bg-white/65 p-4 shadow-sm backdrop-blur md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
