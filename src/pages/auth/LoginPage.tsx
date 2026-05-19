import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/app/auth";
import { formatApiErrorMessage } from "@/lib/api";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const nextPath = typeof location.state === "object" && location.state && "from" in location.state
    ? String((location.state as { from?: string }).from ?? "/app")
    : "/app";

  if (!isLoading && isAuthenticated) {
    return <Navigate to={nextPath || "/app"} replace />;
  }

  const submit = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await login({ email, password });
      navigate(nextPath || "/app", { replace: true });
    } catch (error) {
      setErrorMessage(formatApiErrorMessage(error, "登录失败"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-screen max-w-md items-center px-4 py-10">
      <div className="w-full rounded-[32px] border border-white/70 bg-white/85 p-8 shadow-glow backdrop-blur">
        <h1 className="text-2xl font-semibold text-slate-950">登录 WebUI</h1>
        <p className="mt-2 text-sm text-slate-500">使用你的账号进入多用户写作空间。</p>
        <div className="mt-6 space-y-4">
          <label className="block space-y-2 text-sm text-slate-600">
            <span>邮箱</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-primary" type="email" autoComplete="email" />
          </label>
          <label className="block space-y-2 text-sm text-slate-600">
            <span>密码</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-primary" type="password" autoComplete="current-password" />
          </label>
          {errorMessage && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>}
          <button onClick={submit} disabled={submitting || !email.trim() || !password} className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-60">
            {submitting ? "登录中..." : "登录"}
          </button>
        </div>
        <div className="mt-5 text-sm text-slate-500">
          还没有账号？ <Link to="/app/register" className="text-primary hover:underline">去注册</Link>
        </div>
      </div>
    </section>
  );
}
