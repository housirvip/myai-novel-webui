import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "@/app/auth";
import { formatApiErrorMessage } from "@/lib/api";

export function RegisterPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, register } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  const submit = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await register({ displayName, email, password });
      navigate("/app", { replace: true });
    } catch (error) {
      setErrorMessage(formatApiErrorMessage(error, "注册失败"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-screen max-w-md items-center px-4 py-10">
      <div className="w-full rounded-[32px] border border-white/70 bg-white/85 p-8 shadow-glow backdrop-blur">
        <h1 className="text-2xl font-semibold text-slate-950">注册账号</h1>
        <p className="mt-2 text-sm text-slate-500">注册后会自动进入你的个人书籍空间。</p>
        <div className="mt-6 space-y-4">
          <label className="block space-y-2 text-sm text-slate-600">
            <span>显示名称</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-primary" autoComplete="nickname" />
          </label>
          <label className="block space-y-2 text-sm text-slate-600">
            <span>邮箱</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-primary" type="email" autoComplete="email" />
          </label>
          <label className="block space-y-2 text-sm text-slate-600">
            <span>密码</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-primary" type="password" autoComplete="new-password" />
          </label>
          {errorMessage && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>}
          <button onClick={submit} disabled={submitting || !displayName.trim() || !email.trim() || password.length < 8} className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-60">
            {submitting ? "注册中..." : "注册并进入"}
          </button>
        </div>
        <div className="mt-5 text-sm text-slate-500">
          已有账号？ <Link to="/app/login" className="text-primary hover:underline">去登录</Link>
        </div>
      </div>
    </section>
  );
}
