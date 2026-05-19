import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="flex min-h-[50vh] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-6 text-center shadow-sm">
      <p className="text-sm font-medium text-primary">404</p>
      <h2 className="mt-2 text-3xl font-semibold text-slate-950">页面不存在</h2>
      <p className="mt-3 max-w-md text-sm text-slate-500">当前 WebUI 还在持续建设中，你访问的页面还没有接入，或者链接地址无效。</p>
      <Link to="/app" className="mt-6 rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-glow">
        返回书籍首页
      </Link>
    </section>
  );
}
